// All money math is done in integer paise to avoid floating point drift.
// Rules (documented in openapi.yaml):
//   discount  = coupon% of subtotal
//   tax       = 5% GST on (subtotal - discount)
//   shipping  = INR 49 if the order has physical books and (subtotal - discount) < INR 500, else free
//   points    = 1 gift point = INR 1, capped by balance and by the amount payable
//   earned    = 1 gift point per full INR 100 paid
export const TAX_RATE_BP = 500;
export const SHIPPING_FEE = 4_900;
export const FREE_SHIPPING_FROM = 50_000;
export const PAISE_PER_POINT = 100;
export const PAISE_PER_EARNED_POINT = 10_000;

export function computeTotals({ lines, couponPercent = 0, pointsRequested = 0, pointsAvailable = 0 }) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const hasPhysical = lines.some((l) => l.physical);
  const discount = Math.round((subtotal * couponPercent) / 100);
  const taxable = subtotal - discount;
  const tax = Math.round((taxable * TAX_RATE_BP) / 10_000);
  const shippingFee = hasPhysical && taxable < FREE_SHIPPING_FROM ? SHIPPING_FEE : 0;
  const beforePoints = taxable + tax + shippingFee;
  const pointsRedeemed = Math.max(
    0,
    Math.min(pointsRequested, pointsAvailable, Math.floor(beforePoints / PAISE_PER_POINT)),
  );
  const total = beforePoints - pointsRedeemed * PAISE_PER_POINT;
  const pointsEarned = Math.floor(total / PAISE_PER_EARNED_POINT);
  return { subtotal, discount, tax, shippingFee, pointsRedeemed, pointsEarned, total };
}

export function totalsToApi(t, couponCode = null) {
  return {
    subtotal: t.subtotal / 100,
    discount: t.discount / 100,
    tax: t.tax / 100,
    shippingFee: t.shippingFee / 100,
    pointsRedeemed: t.pointsRedeemed,
    pointsEarned: t.pointsEarned,
    total: t.total / 100,
    currency: "INR",
    couponCode,
  };
}
