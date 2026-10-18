import { Link, NavLink, useNavigate } from "react-router-dom";
import { useStore } from "../store";
import { api } from "../api";

const CartIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 11.2a1 1 0 001 .8h8.9a1 1 0 001-.8L20 8H6.2" />
    <circle cx="9.5" cy="20" r="1.2" />
    <circle cx="17" cy="20" r="1.2" />
  </svg>
);

const linkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-ink-700 hover:text-white ${
    isActive ? "text-white" : "text-slate-300"
  }`;

export default function Navbar() {
  const { user, setUser, cartCount, wishIds, refresh, notify } = useStore();
  const navigate = useNavigate();

  const signOut = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    await refresh().catch(() => {});
    notify("Signed out", "success");
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-900/95 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Link to="/" className="text-xl font-bold tracking-tight text-white hover:text-sky-400">
          E-Bookstore
        </Link>

        <ul className="flex items-center gap-1 sm:gap-2">
          <li className="hidden sm:block">
            <NavLink to="/orders" className={linkClass}>My Orders</NavLink>
          </li>
          <li className="hidden sm:block">
            <NavLink to="/wishlist" className={linkClass}>
              My Wishlist{wishIds.size > 0 && <span className="ml-1.5 text-xs text-slate-400">({wishIds.size})</span>}
            </NavLink>
          </li>
          <li className="hidden sm:block">
            <NavLink to="/writers" className={linkClass}>My Writers</NavLink>
          </li>
          <li>
            <Link
              to="/cart"
              className="relative block rounded-md p-2 text-slate-300 hover:bg-ink-700 hover:text-white"
              aria-label={`Cart, ${cartCount} items`}
            >
              <CartIcon />
              {cartCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </li>
          <li className="ml-1 flex items-center gap-2 border-l border-ink-700 pl-3">
            {user && !user.isGuest ? (
              <>
                <span className="hidden text-sm text-slate-300 md:inline" title={`${user.giftPoints} gift points`}>
                  {user.fullName} · <span className="text-amber-400">{user.giftPoints} pts</span>
                </span>
                <button type="button" onClick={signOut} className="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-ink-700 hover:text-white">
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/login" className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500">
                Sign in
              </Link>
            )}
          </li>
        </ul>
      </nav>
    </header>
  );
}
