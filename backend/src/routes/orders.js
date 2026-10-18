import { Router } from "express";
import { z } from "zod";
import { query, tx } from "../db.js";
import { HttpError, idSchema, parse } from "../http.js";
import { requireRegistered } from "../auth.js";
import { assertStock, findCoupon, loadCartLines, priceCart } from "../cartService.js";
import { estimatedDelivery, isPhysical, toPaise } from "../serializers.js";
import { totalsToApi } from "../pricing.js";

const router = Router();

const CANCEL_WINDOW_HOURS = 48;

const addressSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
  addressLine: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(100),
  city: z.string().trim().min(1).max(60),
  pin: z.string().regex(/^[0-9]{6}$/, "PIN must be 6 digits"),
  phone: z.string().regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number"),
  state: z.string().trim().min(1).max(60),
  country: z.string().trim().min(1).max(60),
});

const createSchema = z
  .object({
    addressId: idSchema.optional(),
    address: addressSchema.optional(),
    couponCode: z.string().trim().max(20).optional(),
    paymentMethod: z.enum(["upi", "card", "netbanking", "wallet", "cod"]),
    usePoints: z.coerce.number().int().min(0).max(1_000_000).default(0),
  })
  .refine((v) => v.addressId || v.address, { message: "Provide addressId or address", path: ["address"] });

const idempotencyKey = z.string().uuid();

function mapAddress(r) {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    addressLine: r.address_line,
    email: r.email,
    city: r.city,
    pin: r.pin,
    phone: r.phone,
    state: r.state,
    country: r.country,
  };
}

function mapOrder(o, items) {
  const cancellableUntil = new Date(new Date(o.created_at).getTime() + CANCEL_WINDOW_HOURS * 3_600_000);
  const cancellable = ["pending", "paid"].includes(o.status) && cancellableUntil > new Date();
  return {
    id: o.id,
    status: o.status,
    paymentMethod: o.payment_method,
    paymentReference: o.payment_reference,
    estimatedDelivery: o.estimated_delivery,
    createdAt: o.created_at,
    cancelledAt: o.cancelled_at,
    refundedAt: o.refunded_at,
    cancellable,
    cancellableUntil: cancellable ? cancellableUntil.toISOString() : null,
    items,
    totals: totalsToApi(
      {
        subtotal: toPaise(o.subtotal),
        discount: toPaise(o.discount),
        tax: toPaise(o.tax),
        shippingFee: toPaise(o.shipping_fee),
        pointsRedeemed: o.points_redeemed,
        pointsEarned: o.points_earned,
        total: toPaise(o.total),
      },
      o.coupon_code,
    ),
    address: o.first_name
      ? {
          firstName: o.first_name,
          lastName: o.last_name,
          addressLine: o.address_line,
          email: o.email,
          city: o.city,
          pin: o.pin,
          phone: o.phone,
          state: o.state,
          country: o.country,
        }
      : undefined,
  };
}

const ORDER_SELECT = `
  SELECT o.*, a.first_name, a.last_name, a.address_line, a.email, a.city, a.pin, a.phone, a.state, a.country
  FROM orders o JOIN shipping_addresses a ON a.id = o.shipping_address_id`;

async function loadOrderItems(orderIds, db = { query }) {
  if (!orderIds.length) return new Map();
  const { rows } = await db.query(
    `SELECT oi.order_id, oi.book_id, oi.quantity, oi.unit_price, b.title, b.format, b.cover_url,
            a.id AS author_id, a.name AS author_name
     FROM order_items oi JOIN books b ON b.id = oi.book_id JOIN authors a ON a.id = b.author_id
     WHERE oi.order_id = ANY($1::bigint[]) ORDER BY oi.id`,
    [orderIds],
  );
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.order_id)) map.set(r.order_id, []);
    map.get(r.order_id).push({
      bookId: r.book_id,
      title: r.title,
      format: r.format,
      author: { id: r.author_id, name: r.author_name },
      coverUrl: r.cover_url,
      quantity: r.quantity,
      unitPrice: r.unit_price,
    });
  }
  return map;
}

// Checkout: one transaction. Prices, tax, shipping, discounts and points are computed here from DB state;
// nothing monetary from the client is trusted. Guests may fill a cart, but paying requires a signed-in account.
router.post("/orders", requireRegistered, async (req, res, next) => {
  try {
    const key = parse(idempotencyKey, req.get("Idempotency-Key"));
    const input = parse(createSchema, req.body);

    const result = await tx(async (db) => {
      // Lock the user row: serialises concurrent checkouts and protects the gift-point balance.
      const u = (await db.query("SELECT id, gift_points FROM users WHERE id = $1 FOR UPDATE", [req.user.id])).rows[0];

      const replay = await db.query(`${ORDER_SELECT} WHERE o.user_id = $1 AND o.idempotency_key = $2`, [req.user.id, key]);
      if (replay.rows[0]) return { order: replay.rows[0], replayed: true };

      const lines = await loadCartLines(req.user.id, db, { lock: true });
      if (!lines.length) throw new HttpError(409, "CART_EMPTY", "Your cart is empty");
      assertStock(lines);

      let coupon = null;
      if (input.couponCode) {
        coupon = await findCoupon(input.couponCode, db);
        if (!coupon) throw new HttpError(422, "INVALID_COUPON", "Invalid or expired coupon");
      }
      if (input.usePoints > u.gift_points) {
        throw new HttpError(422, "INSUFFICIENT_POINTS", "Not enough gift points");
      }

      let addressId = input.addressId;
      if (addressId) {
        const own = await db.query("SELECT 1 FROM shipping_addresses WHERE id=$1 AND user_id=$2", [addressId, req.user.id]);
        if (!own.rowCount) throw new HttpError(404, "NOT_FOUND", "Address not found");
      } else {
        const a = input.address;
        addressId = (
          await db.query(
            `INSERT INTO shipping_addresses (user_id, first_name, last_name, address_line, email, city, pin, phone, state, country)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
            [req.user.id, a.firstName, a.lastName, a.addressLine, a.email, a.city, a.pin, a.phone, a.state, a.country],
          )
        ).rows[0].id;
      }

      const { totals } = priceCart(lines, { coupon, pointsRequested: input.usePoints, pointsAvailable: u.gift_points });
      const physicalDays = lines.filter((l) => isPhysical(l.format)).map((l) => l.delivery_days);
      const eta = physicalDays.length ? estimatedDelivery(Math.max(...physicalDays)) : null;

      // Simulated payment: COD stays pending until delivery; everything else is captured immediately.
      const status = input.paymentMethod === "cod" ? "pending" : "paid";
      const paymentRef = input.paymentMethod === "cod" ? null : `SIM-${key.slice(0, 8).toUpperCase()}`;

      const order = (
        await db.query(
          `INSERT INTO orders (user_id, shipping_address_id, coupon_code, status, payment_method, subtotal, discount, tax,
                               shipping_fee, points_redeemed, points_earned, total, payment_reference, idempotency_key, estimated_delivery)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
          [
            req.user.id, addressId, coupon?.code ?? null, status, input.paymentMethod,
            totals.subtotal / 100, totals.discount / 100, totals.tax / 100, totals.shippingFee / 100,
            totals.pointsRedeemed, totals.pointsEarned, totals.total / 100, paymentRef, key, eta,
          ],
        )
      ).rows[0];

      for (const l of lines) {
        await db.query("INSERT INTO order_items (order_id, book_id, quantity, unit_price) VALUES ($1,$2,$3,$4)", [
          order.id, l.id, l.quantity, l.price,
        ]);
        if (isPhysical(l.format)) {
          await db.query("UPDATE books SET stock = stock - $1 WHERE id = $2", [l.quantity, l.id]);
        }
      }
      await db.query("UPDATE users SET gift_points = gift_points - $1 + $2 WHERE id = $3", [
        totals.pointsRedeemed, totals.pointsEarned, req.user.id,
      ]);
      await db.query("DELETE FROM cart_items WHERE user_id = $1", [req.user.id]);

      const full = (await db.query(`${ORDER_SELECT} WHERE o.id = $1`, [order.id])).rows[0];
      return { order: full, replayed: false };
    });

    const items = (await loadOrderItems([result.order.id])).get(result.order.id) ?? [];
    res.status(result.replayed ? 200 : 201).json(mapOrder(result.order, items));
  } catch (err) {
    next(err);
  }
});

router.get("/orders", async (req, res, next) => {
  try {
    if (!req.user) return res.json({ items: [] });
    const { rows } = await query(`${ORDER_SELECT} WHERE o.user_id = $1 ORDER BY o.created_at DESC, o.id DESC LIMIT 100`, [
      req.user.id,
    ]);
    const items = await loadOrderItems(rows.map((r) => r.id));
    res.json({ items: rows.map((o) => mapOrder(o, items.get(o.id) ?? [])) });
  } catch (err) {
    next(err);
  }
});

router.get("/orders/:id", async (req, res, next) => {
  try {
    const id = parse(idSchema, req.params.id);
    if (!req.user) throw new HttpError(404, "NOT_FOUND", "Order not found");
    const { rows } = await query(`${ORDER_SELECT} WHERE o.id = $1 AND o.user_id = $2`, [id, req.user.id]);
    if (!rows[0]) throw new HttpError(404, "NOT_FOUND", "Order not found");
    const items = await loadOrderItems([id]);
    res.json(mapOrder(rows[0], items.get(id) ?? []));
  } catch (err) {
    next(err);
  }
});

// Cancel within 48 hours of purchase: restocks, refunds gift points and marks the payment refunded.
router.post("/orders/:id/cancel", async (req, res, next) => {
  try {
    const id = parse(idSchema, req.params.id);
    if (!req.user) throw new HttpError(404, "NOT_FOUND", "Order not found");

    await tx(async (db) => {
      const found = await db.query("SELECT * FROM orders WHERE id = $1 AND user_id = $2 FOR UPDATE", [id, req.user.id]);
      const o = found.rows[0];
      if (!o) throw new HttpError(404, "NOT_FOUND", "Order not found");
      if (!["pending", "paid"].includes(o.status)) {
        throw new HttpError(409, "NOT_CANCELLABLE", "This order can no longer be cancelled");
      }
      if (Date.now() - new Date(o.created_at).getTime() > CANCEL_WINDOW_HOURS * 3_600_000) {
        throw new HttpError(409, "CANCEL_WINDOW_EXPIRED", `Orders can only be cancelled within ${CANCEL_WINDOW_HOURS} hours`);
      }
      const items = await db.query(
        `SELECT oi.book_id, oi.quantity, b.format FROM order_items oi JOIN books b ON b.id = oi.book_id WHERE oi.order_id = $1`,
        [id],
      );
      for (const it of items.rows) {
        if (isPhysical(it.format)) await db.query("UPDATE books SET stock = stock + $1 WHERE id = $2", [it.quantity, it.book_id]);
      }
      await db.query(
        "UPDATE users SET gift_points = GREATEST(0, gift_points + $1 - $2) WHERE id = $3",
        [o.points_redeemed, o.points_earned, req.user.id],
      );
      await db.query(
        `UPDATE orders SET status = 'cancelled', cancelled_at = now(),
                refunded_at = CASE WHEN payment_reference IS NOT NULL THEN now() END
         WHERE id = $1`,
        [id],
      );
    });

    const { rows } = await query(`${ORDER_SELECT} WHERE o.id = $1`, [id]);
    const items = await loadOrderItems([id]);
    res.json(mapOrder(rows[0], items.get(id) ?? []));
  } catch (err) {
    next(err);
  }
});

// Saved addresses (used by the "select the address for delivery" step).
router.get("/addresses", async (req, res, next) => {
  try {
    if (!req.user) return res.json({ items: [] });
    const { rows } = await query(
      `SELECT DISTINCT ON (first_name, last_name, address_line, pin) *
       FROM shipping_addresses WHERE user_id = $1
       ORDER BY first_name, last_name, address_line, pin, created_at DESC`,
      [req.user.id],
    );
    res.json({ items: rows.map(mapAddress) });
  } catch (err) {
    next(err);
  }
});

export default router;
