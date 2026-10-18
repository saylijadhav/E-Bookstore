import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import FilterBar from "../components/FilterBar";
import { BookGrid, BookRow, ErrorNote, Loading } from "../components/BookSections";
import { useAsync } from "../useAsync";
import { api } from "../api";
import { useStore } from "../store";

const FILTER_KEYS = ["q", "language", "format", "minPrice", "maxPrice", "sort", "authorId", "publisherId"];

// Debounce the search box so we do not fire a request on every keystroke.
function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Brands({ activeId, onPick }) {
  const { data } = useAsync(() => api.publishers(), []);
  if (!data?.items.length) return null;
  return (
    <section aria-label="Browse by brand" className="flex flex-wrap items-center gap-2">
      <h2 className="mr-2 text-sm font-semibold text-slate-300">Brands</h2>
      {data.items.map((p) => {
        const active = String(p.id) === activeId;
        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(active ? "" : String(p.id))}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              active ? "border-sky-500 bg-sky-500/15 text-sky-300" : "border-ink-600 text-slate-300 hover:bg-ink-700"
            }`}
          >
            {p.name} <span className="text-slate-500">({p.bookCount})</span>
          </button>
        );
      })}
    </section>
  );
}

function LandingRows() {
  const { user } = useStore();
  const { data, error, loading, reload } = useAsync(() => api.home(), [user?.id]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  return (
    <div className="flex flex-col gap-8">
      <BookRow
        title="Recommended for You"
        subtitle={data.recommended.personalised ? "Based on your order history" : "Top rated picks"}
        books={data.recommended.items}
      />
      <BookRow title="Bestsellers this Month" books={data.bestsellers} />
      <BookRow title="New Launches" books={data.newLaunches} />
    </div>
  );
}

export default function Catalogue() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: cats } = useAsync(() => api.categories(), []);

  const filtering = Boolean(slug) || FILTER_KEYS.some((k) => k !== "sort" && params.get(k)) || params.get("sort");
  const page = Number(params.get("page") ?? 1) || 1;
  const q = useDebounced(params.get("q") ?? "");

  const query = {
    category: slug,
    q,
    language: params.get("language"),
    format: params.get("format"),
    minPrice: params.get("minPrice"),
    maxPrice: params.get("maxPrice"),
    sort: params.get("sort"),
    authorId: params.get("authorId"),
    publisherId: params.get("publisherId"),
    page,
    pageSize: 12,
  };
  const { data, error, loading, reload } = useAsync(
    () => (filtering ? api.books(query) : Promise.resolve(null)),
    [filtering, JSON.stringify(query)],
  );

  const change = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    next.delete("page");
    setParams(next, { replace: true });
  };
  const goPage = (p) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    setParams(next);
    window.scrollTo({ top: 0 });
  };

  const title = slug ? cats?.items.find((c) => c.slug === slug)?.name ?? "Books" : "All Books";
  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <section className="flex flex-col gap-5" aria-labelledby="catalogue-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 id="catalogue-heading" className="text-2xl font-bold text-white">
          {filtering ? title : "Discover your next read"}
        </h1>
        {filtering && data && (
          <p className="text-sm text-slate-400">
            {data.total} {data.total === 1 ? "result" : "results"}
            {(params.get("authorId") || params.get("publisherId")) && (
              <button type="button" onClick={() => change({ authorId: "", publisherId: "" })} className="ml-3 text-sky-400 hover:underline">
                Clear writer/brand filter
              </button>
            )}
          </p>
        )}
      </div>

      <FilterBar params={params} onChange={change} />
      <Brands activeId={params.get("publisherId") ?? ""} onPick={(id) => change({ publisherId: id })} />

      {!filtering ? (
        <LandingRows />
      ) : error ? (
        <ErrorNote error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-ink-600 p-10 text-center text-slate-400">No books match your filters.</p>
      ) : (
        <>
          <BookGrid books={data.items} />
          {pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-center gap-3 pt-2">
              <button type="button" disabled={page <= 1} onClick={() => goPage(page - 1)} className="rounded-md border border-ink-600 px-3 py-1.5 text-sm hover:bg-ink-700 disabled:opacity-40">
                Previous
              </button>
              <span className="text-sm text-slate-400">Page {page} of {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => goPage(page + 1)} className="rounded-md border border-ink-600 px-3 py-1.5 text-sm hover:bg-ink-700 disabled:opacity-40">
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
