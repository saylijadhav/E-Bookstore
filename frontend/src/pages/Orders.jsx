import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Row } from "./Cart";
import { ErrorNote, Loading } from "../components/BookSections";
import Modal from "../components/Modal";
import { useAsync } from "../useAsync";
import { api, formatINR } from "../api";
import { useStore } from "../store";

const GREEN = "bg-emerald-500/15 text-emerald-300";
const STATUS_STYLE = {
  pending: GREEN,
  paid: GREEN,
  shipped: "bg-sky-500/15 text-sky-300",
  delivered: GREEN,
  cancelled: "bg-red-500/15 text-red-300",
};
const METHOD = { upi: "UPI", card: "Card", netbanking: "Net banking", wallet: "Wallet", cod: "Cash on delivery" };

const fmtDate = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const fmtDay = (d) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");
};

// A cash-on-delivery order is accepted but unpaid until the courier collects, so the stored status is
// "pending". Customers should see it as a successfully placed order, not as a problem.
export function statusLabel({ status, paymentMethod }) {
  if (status === "pending" && paymentMethod === "cod") return "Order placed · Pay on delivery";
  if (status === "paid") return "Paid";
  return status[0].toUpperCase() + status.slice(1);
}

export function StatusPill({ order }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[order.status]}`}>{statusLabel(order)}</span>
  );
}

function useBuyAgain() {
  const { setQuantity, notify } = useStore();
  return async (items) => {
    let added = 0;
    for (const it of items) {
      if (await setQuantity(it.bookId, 1)) added += 1;
    }
    if (added) notify(`Added ${added} item${added > 1 ? "s" : ""} to your cart`, "success");
  };
}

export function Orders() {
  const { user } = useStore();
  const { data, error, loading, reload } = useAsync(() => api.orders(), [user?.id]);
  const buyAgain = useBuyAgain();

  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="orders-heading">
      <h1 id="orders-heading" className="text-2xl font-bold text-white">My Orders</h1>
      {data.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-600 p-10 text-center text-slate-400">
          You have not placed any orders yet. <Link to="/" className="text-sky-400 hover:underline">Start shopping</Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {data.items.map((o) => (
            <li key={o.id} className="rounded-lg border border-ink-700 bg-ink-900 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link to={`/orders/${o.id}`} className="font-semibold text-white hover:text-sky-400">Order #{o.id}</Link>
                  <p className="text-xs text-slate-400">{fmtDate(o.createdAt)} · {formatINR(o.totals.total)}</p>
                </div>
                <StatusPill order={o} />
              </div>
              <ul className="mt-3 divide-y divide-ink-700 text-sm">
                {o.items.map((it) => (
                  <li key={it.bookId} className="flex justify-between py-2">
                    <Link to={`/books/${it.bookId}`} className="hover:text-sky-400">{it.title} <span className="text-slate-500">× {it.quantity}</span></Link>
                    <span>{formatINR(it.unitPrice * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-3">
                <button type="button" onClick={() => buyAgain(o.items)} className="rounded-md border border-sky-500 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/10">
                  Buy it again
                </button>
                <Link to={`/orders/${o.id}`} className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-300 hover:underline">View details</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PurchaseSuccess({ order, onClose }) {
  const navigate = useNavigate();
  return (
    <Modal labelledBy="success-title" onClose={onClose} className="max-w-xl p-6 text-center">
      <svg viewBox="0 0 24 24" className="mx-auto h-12 w-12 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12.5l3 3 6-6.5" />
      </svg>
      <h1 id="success-title" className="mt-3 text-lg font-semibold text-white">
        Your purchase of the following reads is successful
      </h1>
      <p className="mt-1 text-xs text-slate-400">
        Order #{order.id} {order.paymentMethod === "cod" ? "will be paid on delivery." : "has been paid."}
      </p>
      <ul className="mt-5 grid gap-3 text-left sm:grid-cols-2">
        {order.items.map((it) => (
          <li key={it.bookId} className="rounded-md border border-ink-700 p-3 text-sm">
            <Link to={`/books/${it.bookId}`} className="font-semibold text-white hover:text-sky-400">{it.title}</Link>
            <p className="text-xs text-slate-400">by {it.author.name} · <span className="capitalize">{it.format}</span></p>
            <p className="mt-1 font-bold text-white">{formatINR(it.unitPrice)} <span className="text-xs font-normal text-slate-500">× {it.quantity}</span></p>
            {order.estimatedDelivery && it.format !== "ebook" && it.format !== "audiobook" && (
              <p className="text-xs text-slate-400">Delivery by {fmtDay(order.estimatedDelivery)}</p>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => { onClose(); navigate("/"); }} className="mt-6 rounded-md bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-500">
        Continue your Shopping
      </button>
    </Modal>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const { refresh, notify } = useStore();
  const { data: o, error, loading, reload } = useAsync(() => api.order(id), [id]);
  const [busy, setBusy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(Boolean(state?.placed));
  const buyAgain = useBuyAgain();

  if (loading && !o) return <Loading />;
  if (error) {
    return error.status === 404 ? (
      <p className="py-10 text-center text-slate-400">Order not found. <Link to="/orders" className="text-sky-400 hover:underline">My orders</Link></p>
    ) : (
      <ErrorNote error={error} onRetry={reload} />
    );
  }

  const cancel = async () => {
    if (!window.confirm("Cancel this order? Paid orders are refunded.")) return;
    setBusy(true);
    try {
      await api.cancelOrder(o.id);
      notify("Order cancelled", "success");
      await refresh().catch(() => {});
      reload();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {showSuccess && o.status !== "cancelled" && <PurchaseSuccess order={o} onClose={() => setShowSuccess(false)} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-white">Order #{o.id}</h2>
        <StatusPill order={o} />
      </div>
      <p className="-mt-3 text-sm text-slate-400">
        Placed {fmtDate(o.createdAt)} · {METHOD[o.paymentMethod]}
        {o.paymentReference && <> · Ref {o.paymentReference}</>}
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5">
          <section aria-label="Items" className="rounded-lg border border-ink-700 bg-ink-900 p-5">
            <ul className="divide-y divide-ink-700 text-sm">
              {o.items.map((it) => (
                <li key={it.bookId} className="flex justify-between py-2">
                  <Link to={`/books/${it.bookId}`} className="hover:text-sky-400">{it.title} <span className="text-slate-500">× {it.quantity}</span></Link>
                  <span>{formatINR(it.unitPrice * it.quantity)}</span>
                </li>
              ))}
            </ul>
          </section>
          {o.address && (
            <section aria-label="Delivery address" className="rounded-lg border border-ink-700 bg-ink-900 p-5 text-sm">
              <h3 className="mb-1 font-semibold text-white">Delivering to</h3>
              <p>{o.address.firstName} {o.address.lastName}</p>
              <p className="text-slate-400">{o.address.addressLine}, {o.address.city} {o.address.pin}, {o.address.state}, {o.address.country}</p>
              <p className="text-slate-400">{o.address.phone} · {o.address.email}</p>
              {o.estimatedDelivery && o.status !== "cancelled" && <p className="mt-2 text-slate-300">Estimated delivery: {fmtDay(o.estimatedDelivery)}</p>}
            </section>
          )}
        </div>

        <aside className="h-fit rounded-lg border border-ink-700 bg-ink-900 p-5">
          <dl className="flex flex-col gap-2">
            <Row label="Subtotal" value={formatINR(o.totals.subtotal)} />
            <Row label="Taxes" value={formatINR(o.totals.tax)} />
            <Row label="Shipping" value={o.totals.shippingFee ? formatINR(o.totals.shippingFee) : "Free"} />
            {o.totals.discount > 0 && <Row label={`Coupon (${o.totals.couponCode})`} value={`− ${formatINR(o.totals.discount)}`} />}
            {o.totals.pointsRedeemed > 0 && <Row label={`Gift points (${o.totals.pointsRedeemed})`} value={`− ${formatINR(o.totals.pointsRedeemed)}`} />}
            <div className="mt-2 flex justify-between border-t border-ink-700 pt-3 font-bold text-white"><dt>Total</dt><dd>{formatINR(o.totals.total)}</dd></div>
          </dl>
          {o.status === "cancelled" ? (
            <p className="mt-4 text-sm text-slate-400">
              Cancelled {fmtDate(o.cancelledAt)}.{o.refundedAt && " Your payment has been refunded."}
            </p>
          ) : (
            <>
              <button type="button" disabled={!o.cancellable || busy} onClick={cancel} className="mt-5 w-full rounded-md border border-red-500 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? "Cancelling…" : "Cancel order"}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                {o.cancellable ? `You can cancel until ${fmtDate(o.cancellableUntil)} (within 48 hours of purchase).` : "The 48-hour cancellation window has passed."}
              </p>
            </>
          )}
          <button type="button" onClick={() => buyAgain(o.items)} className="mt-3 w-full rounded-md border border-sky-500 py-2.5 text-sm font-semibold text-sky-300 hover:bg-sky-500/10">
            Buy it again
          </button>
        </aside>
      </div>
    </div>
  );
}
