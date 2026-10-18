import { query } from "./db.js";
import { HttpError } from "./http.js";
import { bookSelect, isPhysical, mapBook, toPaise } from "./serializers.js";
import { computeTotals, totalsToApi } from "./pricing.js";

// Loads the user's cart lines joined to book data. `db` can be a transaction client.
export async function loadCartLines(userId, db = { query }, { lock = false } = {}) {
  const { rows } = await db.query(
    `${bookSelect("ci.quantity")}
     JOIN cart_items ci ON ci.book_id = b.id AND ci.user_id = $1
     ORDER BY ci.updated_at, b.id ${lock ? "FOR UPDATE OF b" : ""}`,
    [userId],
  );
  return rows;
}

export async function findCoupon(code, db = { query }) {
  if (!code) return null;
  const { rows } = await db.query(
    `SELECT code, discount_percent FROM coupons
     WHERE code = $1 AND active AND (expires_at IS NULL OR expires_at > now())`,
    [code.trim().toUpperCase()],
  );
  return rows[0] ?? null;
}

export function priceCart(rows, { coupon = null, pointsRequested = 0, pointsAvailable = 0 } = {}) {
  const lines = rows.map((r) => ({
    unitPrice: toPaise(r.price),
    quantity: r.quantity,
    physical: isPhysical(r.format),
  }));
  const totals = computeTotals({
    lines,
    couponPercent: coupon ? Number(coupon.discount_percent) : 0,
    pointsRequested,
    pointsAvailable,
  });
  return { totals, apiTotals: totalsToApi(totals, coupon?.code ?? null) };
}

export async function buildCart(user, { couponCode, usePoints = 0 } = {}) {
  const rows = await loadCartLines(user.id);
  let coupon = null;
  let couponError = null;
  if (couponCode) {
    coupon = await findCoupon(couponCode);
    if (!coupon) couponError = "Invalid or expired coupon";
  }
  const { apiTotals } = priceCart(rows, {
    coupon,
    pointsRequested: usePoints,
    pointsAvailable: user.gift_points,
  });
  return {
    items: rows.map((r) => ({
      book: mapBook(r),
      quantity: r.quantity,
      lineTotal: (toPaise(r.price) * r.quantity) / 100,
    })),
    totals: apiTotals,
    couponError,
    giftPointsAvailable: user.gift_points,
  };
}

export function assertStock(rows) {
  for (const r of rows) {
    if (isPhysical(r.format) && r.stock < r.quantity) {
      throw new HttpError(409, "OUT_OF_STOCK", `"${r.title}" has only ${r.stock} left in stock`);
    }
  }
}
