import { Link } from "react-router-dom";
import { BookGrid, ErrorNote, Loading } from "../components/BookSections";
import { useAsync } from "../useAsync";
import { api } from "../api";
import { useStore } from "../store";

export function Wishlist() {
  const { wishIds } = useStore();
  const { data, error, loading, reload } = useAsync(() => api.wishlist(), [wishIds.size]);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  return (
    <section className="flex flex-col gap-4" aria-labelledby="wish-heading">
      <h1 id="wish-heading" className="text-2xl font-bold text-white">My Wishlist</h1>
      {data.items.length === 0 ? (
        <p className="text-slate-400">Nothing saved yet. <Link to="/" className="text-sky-400 hover:underline">Browse books</Link></p>
      ) : (
        <BookGrid books={data.items} />
      )}
    </section>
  );
}

export function Writers() {
  const { notify } = useStore();
  const { data, error, loading, reload } = useAsync(() => api.writers(), []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const unfollow = async (w) => {
    try {
      await api.unfollow(w.id);
      notify(`Unfollowed ${w.name}`, "success");
      reload();
    } catch (e) {
      notify(e.message, "error");
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="writers-heading">
      <h1 id="writers-heading" className="text-2xl font-bold text-white">My Writers</h1>
      {data.items.length === 0 ? (
        <p className="text-slate-400">Follow a writer from any book page to see them here.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((w) => (
            <li key={w.id} className="flex flex-col gap-2 rounded-lg border border-ink-700 bg-ink-900 p-5">
              <div className="flex items-center gap-3">
                <div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-ink-700 text-lg font-bold text-white">{w.name[0]}</div>
                <div>
                  <p className="font-semibold text-white">{w.name}</p>
                  <p className="text-xs text-slate-400">{w.bookCount} {w.bookCount === 1 ? "book" : "books"}</p>
                </div>
              </div>
              <p className="line-clamp-3 text-sm text-slate-300">{w.bio}</p>
              <div className="mt-auto flex gap-3 pt-2">
                <Link to={`/?authorId=${w.id}`} className="rounded-md border border-sky-500 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/10">View books</Link>
                <button type="button" onClick={() => unfollow(w)} className="rounded-md px-3 py-1.5 text-xs text-slate-400 hover:underline">Unfollow</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
