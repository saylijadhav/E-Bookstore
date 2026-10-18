import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BookCover from "../components/BookCover";
import StarRating from "../components/StarRating";
import { BookRow, ErrorNote, Loading } from "../components/BookSections";
import { useAsync } from "../useAsync";
import { api, deliveryLabel, formatINR } from "../api";
import { useStore } from "../store";

function RatingInput({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Your rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)}
          className={`text-2xl leading-none ${n <= value ? "text-amber-400" : "text-ink-600 hover:text-amber-300"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function Reviews({ book, onSaved }) {
  const { user, notify } = useStore();
  const [draft, setDraft] = useState({ rating: 0, body: "" });
  const [busy, setBusy] = useState(false);
  const total = Object.values(book.ratingBreakdown).reduce((a, b) => a + b, 0);
  const member = user && !user.isGuest;

  const submit = async (e) => {
    e.preventDefault();
    if (!draft.rating) return;
    setBusy(true);
    try {
      await api.review(book.id, draft);
      setDraft({ rating: 0, body: "" });
      notify("Thanks for your review", "success");
      onSaved();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="reviews-heading" className="rounded-lg border border-ink-700 bg-ink-900 p-6">
      <h2 id="reviews-heading" className="text-lg font-semibold text-white">Ratings &amp; Reviews</h2>

      <div className="mt-4 grid gap-6 sm:grid-cols-[10rem_1fr]">
        <div>
          <p className="text-5xl font-bold text-white">{book.rating.toFixed(1)}</p>
          <StarRating value={book.rating} showValue={false} />
          <p className="mt-1 text-xs text-slate-400">{book.reviewCount.toLocaleString("en-IN")} ratings</p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const pct = total ? Math.round((book.ratingBreakdown[star] / total) * 100) : 0;
            return (
              <li key={star} className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-8">{star} ★</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <span className="block h-full bg-amber-400" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-8 text-right">{pct}%</span>
              </li>
            );
          })}
        </ul>
      </div>

      {member ? (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 border-t border-ink-700 pt-5">
          <h3 className="text-sm font-semibold text-white">Write a review</h3>
          <RatingInput value={draft.rating} onChange={(rating) => setDraft({ ...draft, rating })} />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            maxLength={1000}
            rows={3}
            aria-label="Review text"
            placeholder="Share your thoughts about this book"
            className="rounded-md border border-ink-600 bg-ink-800 p-3 text-sm text-slate-200 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button type="submit" disabled={!draft.rating || busy} className="self-start rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40">
            Submit review
          </button>
        </form>
      ) : (
        <p className="mt-6 border-t border-ink-700 pt-5 text-sm text-slate-400">
          <Link to="/login" className="text-sky-400 hover:underline">Sign in</Link> to write a review.
        </p>
      )}

      <ul className="mt-6 divide-y divide-ink-700">
        {book.reviews.map((r) => (
          <li key={r.id} className="py-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-white">{r.userName}</span>
              <StarRating value={r.rating} showValue={false} />
            </div>
            {r.body && <p className="mt-1 text-sm text-slate-300">{r.body}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, wishIds, toggleWish } = useStore();
  const { data: book, error, loading, reload } = useAsync(() => api.book(id), [id]);
  const { data: writers, reload: reloadWriters } = useAsync(() => api.writers(), []);
  const { notify } = useStore();

  if (loading && !book) return <Loading />;
  if (error) {
    return error.status === 404 ? (
      <p className="py-10 text-center text-slate-400">
        Book not found. <Link to="/" className="text-sky-400 hover:underline">Back to catalogue</Link>
      </p>
    ) : (
      <ErrorNote error={error} onRetry={reload} />
    );
  }

  const inWishlist = wishIds.has(book.id);
  const following = writers?.items.some((w) => w.id === book.writer.id);
  const toggleFollow = async () => {
    try {
      await (following ? api.unfollow(book.writer.id) : api.follow(book.writer.id));
      reloadWriters();
      notify(following ? `Unfollowed ${book.writer.name}` : `Following ${book.writer.name}`, "success");
    } catch (e) {
      notify(e.message, "error");
    }
  };
  const buyNow = async () => {
    await addToCart(book);
    navigate("/cart");
  };

  return (
    <div className="flex flex-col gap-6">
      <Link to="/" className="self-start text-sm text-sky-400 hover:underline">← Back to catalogue</Link>

      <section className="grid gap-8 rounded-lg border border-ink-700 bg-ink-900 p-6 md:grid-cols-[16rem_1fr]">
        <BookCover book={book} className="w-64 max-w-full" />

        <div className="flex flex-col gap-3">
          <ul className="flex flex-wrap gap-1.5">
            {book.tags.map((t) => (
              <li key={t} className="rounded-full bg-ink-700 px-2.5 py-0.5 text-xs font-medium text-slate-300">{t}</li>
            ))}
          </ul>
          <h1 className="text-3xl font-bold text-white">{book.title}</h1>
          <p className="text-sm text-slate-400">
            by <Link to={`/?authorId=${book.author.id}`} className="text-sky-400 hover:underline">{book.author.name}</Link>
            {" · "}
            <Link to={`/?publisherId=${book.publisher.id}`} className="text-sky-400 hover:underline">{book.publisher.name}</Link>
          </p>
          <StarRating value={book.rating} reviews={book.reviewCount} />
          <p className="text-slate-300">{book.description}</p>
          <dl className="grid max-w-sm grid-cols-2 gap-y-1 text-sm">
            <dt className="text-slate-400">Format</dt><dd className="capitalize">{book.format}</dd>
            <dt className="text-slate-400">Language</dt><dd>{book.language}</dd>
            <dt className="text-slate-400">Genre</dt><dd>{book.category}</dd>
          </dl>

          <p className="mt-2 text-3xl font-bold text-white">{formatINR(book.price)}</p>
          <p className="text-sm text-slate-400">{deliveryLabel(book)}</p>
          {!book.inStock && <p className="text-sm font-semibold text-red-400">Out of stock</p>}

          <div className="mt-2 flex flex-wrap gap-3">
            <button type="button" onClick={() => addToCart(book)} disabled={!book.inStock} className="rounded-md bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40">
              Add to Cart
            </button>
            <button type="button" onClick={buyNow} disabled={!book.inStock} className="rounded-md border border-sky-500 px-6 py-2.5 text-sm font-semibold text-sky-300 hover:bg-sky-500/10 disabled:cursor-not-allowed disabled:opacity-40">
              Buy Now
            </button>
            <button
              type="button"
              onClick={() => toggleWish(book)}
              aria-pressed={inWishlist}
              className={`rounded-md border px-6 py-2.5 text-sm font-semibold ${inWishlist ? "border-red-500 bg-red-500/10 text-red-400" : "border-ink-600 text-slate-200 hover:bg-ink-700"}`}
            >
              {inWishlist ? "♥ In Wishlist" : "♡ Add to Wishlist"}
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="writer-heading" className="rounded-lg border border-ink-700 bg-ink-900 p-6">
        <h2 id="writer-heading" className="text-lg font-semibold text-white">About the writer</h2>
        <div className="mt-3 flex items-start gap-4">
          <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink-700 text-xl font-bold text-white">
            {book.writer.name[0]}
          </div>
          <div className="flex-1">
            <p className="font-medium text-white">{book.writer.name}</p>
            <p className="mt-1 text-sm text-slate-300">{book.writer.bio}</p>
            <div className="mt-3 flex gap-3">
              <button type="button" onClick={toggleFollow} aria-pressed={Boolean(following)} className="rounded-md border border-ink-600 px-3 py-1.5 text-xs font-semibold hover:bg-ink-700">
                {following ? "Following" : "Follow writer"}
              </button>
              <Link to={`/?authorId=${book.writer.id}`} className="rounded-md px-3 py-1.5 text-xs font-semibold text-sky-400 hover:underline">
                More by {book.writer.name}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <BookRow title="Related products" books={book.related} />
      <BookRow title="Customers also bought" books={book.alsoBought} />

      <Reviews book={book} onSaved={reload} />
    </div>
  );
}
