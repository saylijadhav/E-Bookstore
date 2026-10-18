import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import request from "supertest";

// Tests run against the dedicated bookworm_test database, never the dev database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? (await import("dotenv")).config({ quiet: true }).parsed?.TEST_DATABASE_URL;
if (!process.env.DATABASE_URL?.includes("bookworm_test")) throw new Error("Refusing to run tests outside a *_test database");

const { createApp } = await import("../src/app.js");
const { pool } = await import("../src/db.js");
const { seed } = await import("../src/seed.js");

const app = createApp();
const origin = "http://127.0.0.1:5173";
const ADDRESS = {
  firstName: "Asha", lastName: "Rao", addressLine: "12 MG Road", email: "asha@example.com",
  city: "Pune", pin: "411001", phone: "9876543210", state: "Maharashtra", country: "India",
};
let ids;
const agent = () => {
  const a = request.agent(app);
  const wrap = (m) => (...args) => a[m](...args).set("Origin", origin);
  return { get: wrap("get"), post: wrap("post"), put: wrap("put"), delete: wrap("delete") };
};
const checkout = (a, body, key = crypto.randomUUID()) =>
  a.post("/api/orders").set("Idempotency-Key", key).send({ address: ADDRESS, paymentMethod: "upi", ...body });
const findBook = async (title) => (await pool.query("SELECT id, stock FROM books WHERE title=$1", [title])).rows[0];
// Placing an order needs a signed-in account; this registers a fresh one.
const member = async () => {
  const a = agent();
  const r = await a.post("/api/auth/register").send({ email: `u${crypto.randomUUID()}@example.com`, password: "a-strong-pass-1", fullName: "Test User" });
  assert.equal(r.status, 201);
  return a;
};

before(async () => {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    ids = await seed(c, { demoPassword: "demo-password-123" });
    await c.query("COMMIT");
  } finally {
    c.release();
  }
});
after(() => pool.end());

test("every genre in the sidebar has at least one book", async () => {
  const a = agent();
  const cats = (await a.get("/api/categories")).body.items;
  assert.equal(cats.length, 19);
  for (const c of cats) {
    const r = await a.get(`/api/books?category=${c.slug}`);
    assert.ok(r.body.total >= 1, `${c.name} is empty`);
  }
});

test("catalogue filters: category, format, price range, search", async () => {
  const a = agent();
  const sh = await a.get("/api/books?category=self-help");
  assert.ok(sh.body.total >= 4 && sh.body.items.every((b) => b.category === "Self-help"));
  const eb = await a.get("/api/books?format=ebook");
  assert.ok(eb.body.items.length > 0 && eb.body.items.every((b) => b.format === "ebook" && b.estimatedDelivery === null));
  const pr = await a.get("/api/books?minPrice=100&maxPrice=150&sort=price_asc");
  assert.ok(pr.body.items.every((b) => b.price >= 100 && b.price <= 150));
  const prices = pr.body.items.map((b) => b.price);
  assert.deepEqual(prices, [...prices].sort((x, y) => x - y));
  assert.equal((await a.get("/api/books?q=midnight")).body.items[0].title, "The Midnight Hour");
  assert.equal((await a.get("/api/books?q=%25")).body.total, 0, "LIKE wildcards are escaped");
  assert.equal((await a.get("/api/books?pageSize=500")).status, 400);
});

test("book detail includes writer bio, rating breakdown and related items; 404s are generic", async () => {
  const a = agent();
  const { id } = await findBook("The Art of Focus");
  const r = await a.get(`/api/books/${id}`);
  assert.equal(r.status, 200);
  assert.ok(r.body.writer.bio.length > 0 && r.body.related.length > 0);
  assert.equal(Object.values(r.body.ratingBreakdown).reduce((x, y) => x + y, 0), r.body.reviewCount);
  assert.equal((await a.get("/api/books/999999")).status, 404);
});

test("home exposes the three landing rows", async () => {
  const r = await agent().get("/api/home");
  assert.equal(r.body.recommended.items.length, 4);
  assert.equal(r.body.bestsellers.length, 4);
  assert.equal(r.body.newLaunches[0].title, "The Lost Kitten");
});

test("guest cart -> checkout math, stock, idempotency, then 48h cancellation restores everything", async () => {
  const a = agent();
  const book = await findBook("The Art of Focus");
  assert.equal((await a.get("/api/cart")).body.items.length, 0);
  const add = await a.post("/api/cart").send({ bookId: book.id, quantity: 2 });
  assert.equal(add.body.totals.subtotal, 798);
  assert.equal(add.body.totals.total, 837.9);

  const coupon = await a.get("/api/cart?coupon=bookworm10");
  assert.equal(coupon.body.totals.discount, 79.8);
  assert.equal((await a.get("/api/cart?coupon=NOPE")).body.couponError, "Invalid or expired coupon");

  // Paying needs an account: the guest registers and keeps the cart.
  await a.post("/api/auth/register").send({ email: `g${crypto.randomUUID()}@example.com`, password: "a-strong-pass-1", fullName: "Guest Turned Member" });
  assert.equal((await a.get("/api/cart")).body.items[0].quantity, 2, "cart survives sign-up");

  const key = crypto.randomUUID();
  const o1 = await checkout(a, { couponCode: "BOOKWORM10" }, key);
  assert.equal(o1.status, 201);
  assert.equal(o1.body.status, "paid");
  assert.equal(o1.body.totals.total, 754.11); // (798 - 79.8) * 1.05
  assert.equal(o1.body.cancellable, true);
  assert.equal((await findBook("The Art of Focus")).stock, book.stock - 2);
  assert.equal((await a.get("/api/cart")).body.items.length, 0, "cart cleared");

  const replay = await checkout(a, { couponCode: "BOOKWORM10" }, key);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.id, o1.body.id, "same idempotency key returns the original order");
  assert.equal((await findBook("The Art of Focus")).stock, book.stock - 2, "no double decrement");

  const hist = await a.get("/api/orders");
  assert.equal(hist.body.items.length, 1);
  assert.equal(hist.body.items[0].items[0].title, "The Art of Focus");

  const cancel = await a.post(`/api/orders/${o1.body.id}/cancel`);
  assert.equal(cancel.body.status, "cancelled");
  assert.ok(cancel.body.refundedAt);
  assert.equal((await findBook("The Art of Focus")).stock, book.stock, "stock restored");
  assert.equal((await a.post(`/api/orders/${o1.body.id}/cancel`)).status, 409);
});

test("guests can fill a cart but cannot place an order", async () => {
  const a = agent();
  const book = await findBook("Atomic Habits");
  assert.equal((await a.post("/api/cart").send({ bookId: book.id, quantity: 1 })).status, 200);
  const r = await checkout(a, {});
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, "UNAUTHENTICATED");
  assert.equal((await a.get("/api/cart")).body.items.length, 1, "cart untouched");
  assert.equal((await findBook("Atomic Habits")).stock, book.stock, "stock untouched");
  assert.equal((await agent().post("/api/orders").send({ address: ADDRESS, paymentMethod: "upi" })).status, 401, "no session at all");
});

test("cancellation window closes after 48 hours", async () => {
  const a = await member();
  const book = await findBook("Atomic Habits");
  await a.post("/api/cart").send({ bookId: book.id, quantity: 1 });
  const o = await checkout(a, { paymentMethod: "cod" });
  assert.equal(o.body.status, "pending");
  await pool.query("UPDATE orders SET created_at = now() - interval '49 hours' WHERE id = $1", [o.body.id]);
  const r = await a.post(`/api/orders/${o.body.id}/cancel`);
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, "CANCEL_WINDOW_EXPIRED");
  assert.equal((await a.get(`/api/orders/${o.body.id}`)).body.cancellable, false);
});

test("wallet is an accepted payment method and unknown methods are rejected", async () => {
  const a = await member();
  const book = await findBook("Atomic Habits");
  await a.post("/api/cart").send({ bookId: book.id, quantity: 1 });
  assert.equal((await checkout(a, { paymentMethod: "bitcoin" })).status, 400);
  const o = await checkout(a, { paymentMethod: "wallet" });
  assert.equal(o.status, 201);
  assert.equal(o.body.status, "paid");
  assert.equal(o.body.paymentMethod, "wallet");
});

test("validation: address, empty cart, stock, coupon, idempotency key", async () => {
  const a = await member();
  assert.equal((await checkout(a, {})).body.error.code, "CART_EMPTY");
  const book = await findBook("Dune");
  await a.post("/api/cart").send({ bookId: book.id, quantity: 1 });
  const bad = await checkout(a, { address: { ...ADDRESS, pin: "12", phone: "123" } });
  assert.equal(bad.status, 400);
  assert.ok(bad.body.error.fields["address.pin"] && bad.body.error.fields["address.phone"]);
  assert.equal((await checkout(a, { couponCode: "FAKE" })).status, 422);
  assert.equal((await a.post("/api/orders").send({ address: ADDRESS, paymentMethod: "upi" })).status, 400);
  assert.equal((await a.post("/api/cart").send({ bookId: book.id, quantity: 999 })).status, 400);
  assert.equal((await a.post("/api/cart").send({ bookId: book.id, quantity: 20 })).status, 409, "over stock");
});

test("concurrent checkouts of the last copy cannot oversell", async () => {
  const book = await findBook("Salt Fat Acid Heat");
  await pool.query("UPDATE books SET stock = 1 WHERE id = $1", [book.id]);
  const users = [await member(), await member()];
  for (const u of users) await u.post("/api/cart").send({ bookId: book.id, quantity: 1 });
  const results = await Promise.all(users.map((u) => checkout(u, {})));
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  assert.equal((await findBook("Salt Fat Acid Heat")).stock, 0);
});

test("register upgrades the guest (cart kept) and awards welcome points; login/logout; auth hygiene", async () => {
  const a = agent();
  const book = await findBook("Meditations");
  await a.post("/api/cart").send({ bookId: book.id, quantity: 1 });
  const reg = await a.post("/api/auth/register").send({ email: "New.User@Example.com", password: "a-strong-pass-1", fullName: "New User" });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.isGuest, false);
  assert.equal(reg.body.user.giftPoints, 100);
  assert.equal(reg.body.user.email, "new.user@example.com");
  assert.equal((await a.get("/api/cart")).body.items.length, 1, "cart survives registration");
  assert.equal((await agent().post("/api/auth/register").send({ email: "new.user@example.com", password: "a-strong-pass-1", fullName: "X" })).status, 409);
  assert.equal((await agent().post("/api/auth/register").send({ email: "x@y.com", password: "short", fullName: "X" })).status, 400);

  const b = agent();
  assert.equal((await b.post("/api/auth/login").send({ email: "new.user@example.com", password: "wrong-password!" })).status, 401);
  assert.equal((await b.post("/api/auth/login").send({ email: "nobody@example.com", password: "wrong-password!" })).status, 401);
  const ok = await b.post("/api/auth/login").send({ email: "new.user@example.com", password: "a-strong-pass-1" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.fullName, "New User");
  assert.ok(!JSON.stringify(ok.body).includes("password"));
  await b.post("/api/auth/logout");
  assert.equal((await b.get("/api/auth/me")).body.user, null);
});

test("gift points are redeemed and earned; reviews need an account; foreign origins blocked", async () => {
  const a = agent();
  const login = await a.post("/api/auth/login").send({ email: "demo@bookworm.test", password: "demo-password-123" });
  assert.equal(login.body.user.giftPoints, 250);
  const book = await findBook("Atomic Habits");
  await a.post("/api/cart").send({ bookId: book.id, quantity: 1 });
  const o = await checkout(a, { usePoints: 100 });
  assert.equal(o.body.totals.pointsRedeemed, 100);
  assert.equal(o.body.totals.total, 105.45); // 149 + 5% tax + 49 shipping - 100 points
  const me = await a.get("/api/auth/me");
  assert.equal(me.body.user.giftPoints, 250 - 100 + o.body.totals.pointsEarned);
  assert.equal((await checkout(a, { usePoints: 99999 })).status, 409, "cart is empty now, checked before points");

  const rev = await a.post(`/api/books/${book.id}/reviews`).send({ rating: 5, body: "Loved it" });
  assert.equal(rev.status, 201);
  assert.equal((await agent().post(`/api/books/${book.id}/reviews`).send({ rating: 5 })).status, 401);
  const evil = await request(app).post("/api/cart").set("Origin", "https://evil.example").send({ bookId: book.id, quantity: 1 });
  assert.equal(evil.status, 403);
});

test("recommendations reflect order history; wishlist and followed writers round-trip", async () => {
  const a = agent();
  await a.post("/api/auth/login").send({ email: "demo@bookworm.test", password: "demo-password-123" });
  const home = await a.get("/api/home");
  assert.equal(home.body.recommended.personalised, true);
  const bought = (await a.get("/api/orders")).body.items.flatMap((o) => o.items.map((i) => i.bookId));
  assert.ok(home.body.recommended.items.every((b) => !bought.includes(b.id)));

  const book = await findBook("Dune");
  assert.equal((await a.put(`/api/wishlist/${book.id}`)).status, 204);
  assert.equal((await a.get("/api/wishlist")).body.items[0].title, "Dune");
  assert.equal((await a.delete(`/api/wishlist/${book.id}`)).status, 204);
  assert.equal((await a.get("/api/wishlist")).body.items.length, 0);

  const author = ids.authorId["Frank Herbert"];
  assert.equal((await a.put(`/api/writers/${author}`)).status, 204);
  assert.equal((await a.get("/api/writers")).body.items[0].name, "Frank Herbert");
});

test("unknown errors are generic and security headers are set", async () => {
  const r = await request(app).get("/api/health");
  assert.equal(r.headers["x-powered-by"], undefined);
  assert.ok(r.headers["x-content-type-options"]);
  assert.equal((await request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{bad")).status, 400);
});
