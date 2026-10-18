export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields ?? {};
  }
}

async function request(method, path, { body, headers, query } = {}) {
  const qs = query
    ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== "" && v !== null))
    : "";
  let res;
  try {
    res = await fetch(`/api${path}${qs}`, {
      method,
      credentials: "same-origin",
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the server. Please try again.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? "ERROR", e?.message ?? "Something went wrong", e?.fields);
  }
  return data;
}

export const api = {
  me: () => request("GET", "/auth/me"),
  register: (body) => request("POST", "/auth/register", { body }),
  login: (body) => request("POST", "/auth/login", { body }),
  logout: () => request("POST", "/auth/logout"),

  books: (query) => request("GET", "/books", { query }),
  home: () => request("GET", "/home"),
  book: (id) => request("GET", `/books/${id}`),
  review: (id, body) => request("POST", `/books/${id}/reviews`, { body }),
  categories: () => request("GET", "/categories"),
  publishers: () => request("GET", "/publishers"),
  author: (id) => request("GET", `/authors/${id}`),

  cart: (query) => request("GET", "/cart", { query }),
  setCartItem: (bookId, quantity) => request("POST", "/cart", { body: { bookId, quantity } }),

  addresses: () => request("GET", "/addresses"),
  placeOrder: (body, key) => request("POST", "/orders", { body, headers: { "Idempotency-Key": key } }),
  orders: () => request("GET", "/orders"),
  order: (id) => request("GET", `/orders/${id}`),
  cancelOrder: (id) => request("POST", `/orders/${id}/cancel`),

  wishlist: () => request("GET", "/wishlist"),
  addWish: (id) => request("PUT", `/wishlist/${id}`),
  removeWish: (id) => request("DELETE", `/wishlist/${id}`),
  writers: () => request("GET", "/writers"),
  follow: (id) => request("PUT", `/writers/${id}`),
  unfollow: (id) => request("DELETE", `/writers/${id}`),
};

export const formatINR = (n) =>
  `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

export function deliveryLabel(book) {
  if (!book.estimatedDelivery) return "Instant download";
  const [y, m, d] = book.estimatedDelivery.split("-").map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return `Delivery by ${text.replace(",", "")}`;
}
