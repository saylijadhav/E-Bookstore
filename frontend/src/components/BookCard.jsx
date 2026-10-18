import { Link } from "react-router-dom";
import BookCover from "./BookCover";
import StarRating from "./StarRating";
import { deliveryLabel, formatINR } from "../api";

const FORMAT_LABEL = { paperback: "Paperback", hardcover: "Hard Cover", ebook: "eBook", audiobook: "Audiobook" };

export default function BookCard({ book }) {
  return (
    <article className="group flex w-full flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-4 transition-colors hover:border-ink-600 hover:bg-ink-800">
      <Link to={`/books/${book.id}`} aria-label={`View ${book.title}`}>
        <BookCover book={book} className="transition-transform group-hover:-translate-y-0.5" />
      </Link>

      <div className="flex flex-1 flex-col gap-1.5">
        <h3 className="text-base font-semibold leading-snug text-white">
          <Link to={`/books/${book.id}`} className="hover:text-sky-400">
            {book.title}
          </Link>
        </h3>
        <Link to={`/?authorId=${book.author.id}`} className="self-start text-sm text-sky-400 hover:underline">
          by {book.author.name}
        </Link>
        <p className="line-clamp-2 text-xs text-slate-400">{book.description}</p>
        <p className="text-xs font-medium text-slate-300">{FORMAT_LABEL[book.format]}</p>
        <ul className="flex flex-wrap gap-1">
          {book.tags.map((t) => (
            <li key={t} className="rounded-full bg-ink-700 px-2 py-0.5 text-[11px] font-medium text-slate-300">
              {t}
            </li>
          ))}
        </ul>
        <StarRating value={book.rating} reviews={book.reviewCount} />
      </div>

      <div>
        <p className="text-xl font-bold text-white">{formatINR(book.price)}</p>
        <p className="text-xs text-slate-400">{deliveryLabel(book)}</p>
      </div>
    </article>
  );
}
