import { NavLink } from "react-router-dom";
import { useAsync } from "../useAsync";
import { api } from "../api";

const itemClass = (active) =>
  `block w-full border-l-4 px-5 py-2 text-left text-sm transition-colors ${
    active
      ? "border-sky-500 bg-ink-700 font-semibold text-white"
      : "border-transparent text-slate-300 hover:bg-ink-800 hover:text-white"
  }`;

export default function GenreSidebar() {
  const { data } = useAsync(() => api.categories(), []);
  const categories = data?.items ?? [];

  return (
    <aside className="hidden w-60 shrink-0 md:block">
      <nav
        aria-label="Genres"
        className="sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto border-r border-ink-700 bg-ink-900 py-4"
      >
        <h2 className="px-5 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Genres</h2>
        <ul>
          <li>
            <NavLink to="/" end className={({ isActive }) => itemClass(isActive)}>
              All
            </NavLink>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <NavLink to={`/category/${c.slug}`} className={({ isActive }) => itemClass(isActive)}>
                {c.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
