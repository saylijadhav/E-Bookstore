import BookCard from "./BookCard";

export function BookGrid({ books }) {
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {books.map((b) => (
        <li key={b.id} className="flex">
          <BookCard book={b} />
        </li>
      ))}
    </ul>
  );
}

export function BookRow({ title, subtitle, books }) {
  if (!books?.length) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>
      <BookGrid books={books} />
    </section>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <p role="status" className="py-10 text-center text-slate-400">
      {label}
    </p>
  );
}

export function ErrorNote({ error, onRetry }) {
  return (
    <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
      {error?.message ?? "Something went wrong."}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-3 underline">
          Retry
        </button>
      )}
    </div>
  );
}
