import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTotals } from "../src/pricing.js";

const physical = (rupees, quantity = 1) => ({ unitPrice: rupees * 100, quantity, physical: true });
const digital = (rupees, quantity = 1) => ({ unitPrice: rupees * 100, quantity, physical: false });

test("subtotal, 5% tax and free shipping above INR 500", () => {
  const t = computeTotals({ lines: [physical(399, 2)] });
  assert.equal(t.subtotal, 79_800);
  assert.equal(t.tax, 3_990);
  assert.equal(t.shippingFee, 0);
  assert.equal(t.total, 83_790);
});

test("INR 49 shipping applies under INR 500 for physical books only", () => {
  assert.equal(computeTotals({ lines: [physical(149)] }).shippingFee, 4_900);
  assert.equal(computeTotals({ lines: [digital(99)] }).shippingFee, 0);
});

test("coupon is a percentage of subtotal and tax is on the discounted amount", () => {
  const t = computeTotals({ lines: [physical(500)], couponPercent: 10 });
  assert.equal(t.discount, 5_000);
  assert.equal(t.tax, 2_250);
  assert.equal(t.total, 45_000 + 2_250 + 4_900); // 450 is under the free-shipping threshold
});

test("gift points: 1 point = INR 1, capped by balance and by amount payable", () => {
  const base = { lines: [physical(600)] };
  assert.equal(computeTotals({ ...base, pointsRequested: 50, pointsAvailable: 100 }).pointsRedeemed, 50);
  assert.equal(computeTotals({ ...base, pointsRequested: 500, pointsAvailable: 100 }).pointsRedeemed, 100);
  const all = computeTotals({ ...base, pointsRequested: 100_000, pointsAvailable: 100_000 });
  assert.equal(all.total, 0);
  assert.equal(all.pointsRedeemed, 630);
});

test("points earned: 1 per full INR 100 actually paid", () => {
  assert.equal(computeTotals({ lines: [physical(600)] }).pointsEarned, 6); // 630 payable
});

test("no floating point drift on awkward prices", () => {
  const t = computeTotals({ lines: [physical(0.1, 3), physical(0.2, 3)] });
  assert.equal(t.subtotal, 90);
  assert.ok(Number.isInteger(t.tax) && Number.isInteger(t.total));
});

test("empty cart totals zero", () => {
  const t = computeTotals({ lines: [] });
  assert.deepEqual([t.subtotal, t.tax, t.shippingFee, t.total], [0, 0, 0, 0]);
});
