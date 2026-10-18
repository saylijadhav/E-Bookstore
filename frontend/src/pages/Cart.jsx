import { Link, useNavigate } from "react-router-dom";
import BookCover from "../components/BookCover";
import { formatINR } from "../api";
import { useStore } from "../store";

export function Row({ label, value, className = "" }) {
  return (
    <div className={`flex justify-between text-sm ${className}`}>
      <dt className="text-slate-400">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function Cart() {
  const { cart, setQuantity } = useStore();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-white">Your Cart</h1>

      {cart.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink-600 p-10 text-center text-slate-400">
          Your cart is empty. <Link to="/" className="text-sky-400 hover:underline">Browse books</Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          <ul className="flex flex-col divide-y divide-ink-700 rounded-lg border border-ink-700 bg-ink-900">
            {cart.items.map(({ book, quantity, lineTotal }) => (
              <li key={book.id} className="flex gap-4 p-4">
                <Link to={`/books/${book.id}`} className="w-20 shrink-0">
                  <BookCover book={book} />
                </Link>
                <div className="flex flex-1 flex-col gap-1">
                  <Link to={`/books/${book.id}`} className="font-semibold text-white hover:text-sky-400">{book.title}</Link>
                  <p className="text-xs text-slate-400">by {book.author.name} · {formatINR(book.price)} each</p>
                  <div className="mt-auto flex items-center gap-2">
                    <button type="button" onClick={() => setQuantity(book.id, quantity - 1)} aria-label={`Decrease quantity of ${book.title}`} className="h-8 w-8 rounded border border-ink-600 hover:bg-ink-700">−</button>
                    <span className="w-6 text-center text-sm" aria-live="polite">{quantity}</span>
                    <button type="button" onClick={() => setQuantity(book.id, quantity + 1)} disabled={quantity >= 20} aria-label={`Increase quantity of ${book.title}`} className="h-8 w-8 rounded border border-ink-600 hover:bg-ink-700 disabled:opacity-40">+</button>
                    <button type="button" onClick={() => setQuantity(book.id, 0)} className="ml-3 text-xs text-red-400 hover:underline">Remove</button>
                  </div>
                </div>
                <p className="font-semibold text-white">{formatINR(lineTotal)}</p>
              </li>
            ))}
          </ul>

          <aside aria-labelledby="basket-heading" className="sticky top-20 h-fit rounded-lg border border-ink-700 bg-ink-900 p-6">
            <h2 id="basket-heading" className="text-lg font-semibold text-white">Basket</h2>
            <dl className="mt-4 flex flex-col gap-2">
              <Row label="Subtotal" value={formatINR(cart.totals.subtotal)} />
              <Row label="Taxes (5%)" value={formatINR(cart.totals.tax)} />
              <Row label="Shipping" value={cart.totals.shippingFee ? formatINR(cart.totals.shippingFee) : "Free"} />
              <div className="mt-2 flex justify-between border-t border-ink-700 pt-3 text-base font-bold text-white">
                <dt>Total</dt>
                <dd>{formatINR(cart.totals.total)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">Free shipping on physical orders of ₹500 or more.</p>
            <button type="button" onClick={() => navigate("/checkout")} className="mt-5 w-full rounded-md bg-blue-600 py-3 text-base font-bold text-white hover:bg-blue-500">
              Proceed to Checkout
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
