import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Row } from "./Cart";
import BookCover from "../components/BookCover";
import PaymentModal from "../components/PaymentModal";
import { ApiError, api, deliveryLabel, formatINR } from "../api";
import { useAsync } from "../useAsync";
import { useStore } from "../store";

const FIELDS = [
  { name: "firstName", label: "First Name", autoComplete: "given-name", half: true, max: 50 },
  { name: "lastName", label: "Last Name", autoComplete: "family-name", half: true, max: 50 },
  { name: "addressLine", label: "Address Line", autoComplete: "street-address", max: 200 },
  { name: "email", label: "Email", type: "email", autoComplete: "email", max: 100 },
  { name: "city", label: "City", autoComplete: "address-level2", half: true, max: 60 },
  { name: "pin", label: "PIN", autoComplete: "postal-code", half: true, inputMode: "numeric", max: 6 },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "tel-national", half: true, inputMode: "numeric", max: 10, prefix: "+91" },
  { name: "state", label: "State", autoComplete: "address-level1", half: true, max: 60 },
  { name: "country", label: "Country", autoComplete: "country-name", max: 60 },
];
const VALIDATORS = {
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Enter a valid email",
  pin: (v) => /^\d{6}$/.test(v) || "PIN must be 6 digits",
  phone: (v) => /^[6-9]\d{9}$/.test(v) || "Enter a valid 10-digit mobile number",
};
const EMPTY = { ...Object.fromEntries(FIELDS.map((f) => [f.name, ""])), country: "India" };

function validate(values) {
  const errors = {};
  for (const f of FIELDS) {
    const v = values[f.name].trim();
    if (!v) errors[f.name] = `${f.label} is required`;
    else if (VALIDATORS[f.name]) {
      const r = VALIDATORS[f.name](v);
      if (r !== true) errors[f.name] = r;
    }
  }
  return errors;
}

const input = (bad) =>
  `w-full rounded-md border bg-ink-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 ${
    bad ? "border-red-500 focus:ring-red-500" : "border-ink-600 focus:border-sky-500 focus:ring-sky-500"
  }`;

function AddressForm({ values, errors, onChange }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map((f) => (
        <div key={f.name} className={f.half ? "" : "sm:col-span-2"}>
          <label htmlFor={f.name} className="mb-1 block text-xs font-medium text-slate-400">{f.label}</label>
          <div className="flex gap-2">
            {f.prefix && (
              <span className="flex items-center rounded-md border border-ink-600 bg-ink-800 px-3 text-sm text-slate-300">{f.prefix}</span>
            )}
            <input
              id={f.name}
              name={f.name}
              type={f.type ?? "text"}
              inputMode={f.inputMode}
              autoComplete={f.autoComplete}
              maxLength={f.max}
              value={values[f.name]}
              onChange={onChange}
              aria-invalid={errors[f.name] ? "true" : undefined}
              aria-describedby={errors[f.name] ? `${f.name}-err` : undefined}
              className={input(errors[f.name])}
            />
          </div>
          {errors[f.name] && <p id={`${f.name}-err`} className="mt-1 text-xs text-red-400">{errors[f.name]}</p>}
        </div>
      ))}
    </div>
  );
}

function Stepper({ book, quantity, onChange }) {
  const btn = "h-7 w-7 rounded border border-ink-600 text-sm hover:bg-ink-700 disabled:opacity-40";
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(book.id, quantity - 1)} aria-label={`Decrease quantity of ${book.title}`} className={btn}>−</button>
      <span className="w-6 text-center text-sm" aria-live="polite">{quantity}</span>
      <button type="button" onClick={() => onChange(book.id, quantity + 1)} disabled={quantity >= 20} aria-label={`Increase quantity of ${book.title}`} className={btn}>+</button>
    </div>
  );
}

export default function Checkout() {
  const { cart, user, setCart, setQuantity, refresh, notify } = useStore();
  const navigate = useNavigate();
  const { data: saved } = useAsync(() => api.addresses(), [user?.id]);

  const [addressId, setAddressId] = useState(null); // null = new address
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState(null);
  const [usePoints, setUsePoints] = useState(0);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [formError, setFormError] = useState("");
  const [payError, setPayError] = useState("");
  const idemKey = useRef(crypto.randomUUID()); // one key per checkout attempt -> safe retries

  const savedAddresses = saved?.items ?? [];
  useEffect(() => {
    if (savedAddresses.length && addressId === null && !values.firstName) setAddressId(savedAddresses[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses.length]);

  // Re-price on the server whenever coupon, points or quantities change.
  const cartSignature = cart.items.map((i) => `${i.book.id}:${i.quantity}`).join(",");
  const { data: priced } = useAsync(
    () => api.cart({ coupon: coupon || undefined, usePoints: usePoints || undefined }),
    [coupon, usePoints, cartSignature],
  );
  const t = priced?.totals ?? cart.totals;
  const itemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  const balance = user?.giftPoints ?? 0;

  useEffect(() => {
    if (priced) setCouponMsg(coupon ? (priced.couponError ? { ok: false, text: priced.couponError } : { ok: true, text: `${coupon} applied` }) : null);
  }, [priced, coupon]);

  if (cart.items.length === 0 && !busy) {
    return (
      <div className="py-10 text-center text-slate-400">
        Your cart is empty. <Link to="/" className="text-sky-400 hover:underline">Browse books</Link>
      </div>
    );
  }
  if (!user) return <Navigate to="/cart" replace />;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
  };

  // "Pay Now": guests are sent to sign in (and returned here); members validate the address, then pay.
  const startPayment = () => {
    setFormError("");
    setPayError("");
    if (user.isGuest) {
      notify("Please sign in to complete your purchase", "info");
      navigate("/login", { state: { from: "/checkout" } });
      return;
    }
    if (addressId === null) {
      const errs = validate(values);
      setErrors(errs);
      if (Object.keys(errs).length) {
        setFormError("Please fix the highlighted fields.");
        return;
      }
    }
    setPaying(true);
  };

  const placeOrder = async (paymentMethod) => {
    setPayError("");
    const body = { paymentMethod, couponCode: coupon || undefined, usePoints: usePoints || undefined };
    if (addressId) body.addressId = addressId;
    else body.address = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));

    setBusy(true);
    try {
      const order = await api.placeOrder(body, idemKey.current);
      setCart({ items: [], totals: { subtotal: 0, total: 0 }, giftPointsAvailable: 0 });
      await refresh().catch(() => {});
      navigate(`/orders/${order.id}`, { replace: true, state: { placed: true } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.fields && Object.keys(e.fields).length) {
        const mapped = {};
        for (const [k, v] of Object.entries(e.fields)) mapped[k.replace(/^address\./, "")] = v;
        setErrors(mapped);
        setFormError(e.message);
        setPaying(false);
      } else {
        setPayError(e.message);
      }
      notify(e.message, "error");
      if (e.status !== 0) idemKey.current = crypto.randomUUID(); // new attempt after a definitive failure
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-white">Shopping Cart</h1>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="items-heading" className="rounded-lg border border-ink-700 bg-ink-900 p-6">
            <h2 id="items-heading" className="mb-3 text-lg font-semibold text-white">Your Items</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {cart.items.map(({ book, quantity }) => (
                <li key={book.id} className="flex gap-3 rounded-md border border-ink-700 p-3">
                  <BookCover book={book} className="w-16 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                    <Link to={`/books/${book.id}`} className="font-semibold text-white hover:text-sky-400">{book.title}</Link>
                    <Link to={`/?authorId=${book.author.id}`} className="self-start text-xs text-sky-400 hover:underline">by {book.author.name}</Link>
                    <p className="text-xs capitalize text-slate-400">{book.format}</p>
                    <p className="font-bold text-white">{formatINR(book.price)}</p>
                    <p className="text-xs text-slate-400">{deliveryLabel(book)}</p>
                    <div className="mt-auto"><Stepper book={book} quantity={quantity} onChange={setQuantity} /></div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="addr-heading" className="rounded-lg border border-ink-700 bg-ink-900 p-6">
            <h2 id="addr-heading" className="mb-4 text-lg font-semibold text-white">Address</h2>
            {savedAddresses.length > 0 && (
              <label className="mb-4 flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={addressId !== null}
                  onChange={(e) => setAddressId(e.target.checked ? savedAddresses[0].id : null)}
                />
                Use Saved Address
              </label>
            )}
            {addressId !== null ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">Select the address for delivery</legend>
                {savedAddresses.map((a) => (
                  <label key={a.id} className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm ${addressId === a.id ? "border-sky-500 bg-sky-500/10" : "border-ink-600"}`}>
                    <input type="radio" name="address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                    <span>
                      <span className="font-medium text-white">{a.firstName} {a.lastName}</span>
                      <span className="block text-slate-400">{a.addressLine}, {a.city} {a.pin}, {a.state}, {a.country} · {a.phone}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <AddressForm values={values} errors={errors} onChange={handleChange} />
            )}
          </section>
        </div>

        <aside aria-labelledby="total-heading" className="sticky top-20 h-fit rounded-lg border border-ink-700 bg-ink-900 p-6">
          <h2 id="total-heading" className="text-lg font-semibold text-white">Grand Total</h2>

          <dl className="mt-4 flex flex-col gap-2">
            <Row label={`Price (${itemCount} ${itemCount === 1 ? "item" : "items"})`} value={formatINR(t.subtotal)} />
            <Row label="Tax" value={formatINR(t.tax ?? 0)} />
            <Row label="Delivery Charges" value={t.shippingFee ? formatINR(t.shippingFee) : "Free"} />
          </dl>

          <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setCoupon(couponInput.trim().toUpperCase()); }}>
            <input type="text" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} maxLength={20} aria-label="Coupon code" placeholder="Apply Coupon" className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm uppercase focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
            <button type="submit" className="rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-500">Apply</button>
          </form>
          {couponMsg && <p className={`mt-1 text-xs ${couponMsg.ok ? "text-emerald-400" : "text-red-400"}`}>{couponMsg.text}</p>}

          {balance > 0 && (
            <div className="mt-4 rounded-md border border-ink-600 p-3 text-sm">
              <label className="flex items-center justify-between gap-2">
                <span>Redeem gift points <span className="text-slate-500">({balance} available)</span></span>
                <input
                  type="checkbox"
                  checked={usePoints > 0}
                  onChange={(e) => setUsePoints(e.target.checked ? balance : 0)}
                  aria-label="Redeem gift points"
                />
              </label>
            </div>
          )}

          <dl className="mt-4 flex flex-col gap-2">
            <Row label={t.couponCode ? `Discount (${t.couponCode})` : "Discount"} value={`− ${formatINR(t.discount ?? 0)}`} />
            {t.pointsRedeemed > 0 && <Row label={`Gift points (${t.pointsRedeemed})`} value={`− ${formatINR(t.pointsRedeemed)}`} />}
            <div className="mt-2 flex justify-between border-t border-ink-700 pt-3 text-base font-bold text-white">
              <dt>Total Amount</dt>
              <dd>{formatINR(t.total)}</dd>
            </div>
          </dl>
          {t.pointsEarned > 0 && <p className="mt-2 text-xs text-amber-400">You will earn {t.pointsEarned} gift points on this order.</p>}

          {formError && <p role="alert" className="mt-4 text-sm text-red-400">{formError}</p>}
          <button type="button" onClick={startPayment} disabled={busy || cart.items.length === 0} className="mt-5 w-full rounded-md bg-blue-600 py-3 text-base font-bold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
            Pay Now
          </button>
        </aside>
      </div>

      {paying && (
        <PaymentModal
          amount={t.total}
          busy={busy}
          error={payError}
          onClose={() => setPaying(false)}
          onPay={placeOrder}
        />
      )}
    </div>
  );
}
