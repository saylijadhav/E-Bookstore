import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";

const StoreContext = createContext(null);
export const useStore = () => useContext(StoreContext);

const EMPTY_CART = { items: [], totals: { subtotal: 0, total: 0 }, giftPointsAvailable: 0 };

export function StoreProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState(EMPTY_CART);
  const [wishIds, setWishIds] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const [ready, setReady] = useState(false);

  const notify = useCallback((message, tone = "info") => {
    setToast({ message, tone, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(async () => {
    const [me, c, w] = await Promise.all([api.me(), api.cart(), api.wishlist()]);
    setUser(me.user);
    setCart(c);
    setWishIds(new Set(w.items.map((b) => b.id)));
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setReady(true));
  }, [refresh]);

  const setQuantity = useCallback(
    async (bookId, quantity) => {
      try {
        setCart(await api.setCartItem(bookId, quantity));
        const me = await api.me();
        setUser(me.user);
        return true;
      } catch (e) {
        notify(e.message, "error");
        return false;
      }
    },
    [notify],
  );

  const addToCart = useCallback(
    async (book) => {
      const existing = cart.items.find((i) => i.book.id === book.id)?.quantity ?? 0;
      if (await setQuantity(book.id, existing + 1)) notify(`Added "${book.title}" to your cart`, "success");
    },
    [cart.items, setQuantity, notify],
  );

  const toggleWish = useCallback(
    async (book) => {
      const has = wishIds.has(book.id);
      try {
        await (has ? api.removeWish(book.id) : api.addWish(book.id));
        setWishIds((prev) => {
          const next = new Set(prev);
          if (has) next.delete(book.id);
          else next.add(book.id);
          return next;
        });
        notify(has ? "Removed from wishlist" : "Added to wishlist", "success");
      } catch (e) {
        notify(e.message, "error");
      }
    },
    [wishIds, notify],
  );

  const value = useMemo(
    () => ({
      user, setUser, cart, setCart, wishIds, ready, toast, notify, refresh,
      cartCount: cart.items.reduce((s, i) => s + i.quantity, 0),
      addToCart, setQuantity, toggleWish,
    }),
    [user, cart, wishIds, ready, toast, notify, refresh, addToCart, setQuantity, toggleWish],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
