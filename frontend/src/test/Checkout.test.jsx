import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Checkout from "../pages/Checkout";

// vi.mock is hoisted above imports, so shared fixtures must be created with vi.hoisted.
const { store, cart } = vi.hoisted(() => {
  const book = {
    id: 1, title: "Joy of Minimalism", author: { id: 7, name: "Daniel Reed" }, category: "Self-help",
    format: "paperback", price: 149, estimatedDelivery: "2026-07-21",
  };
  const cart = {
    items: [{ book, quantity: 1, lineTotal: 149 }],
    totals: { subtotal: 149, tax: 7.45, shippingFee: 49, discount: 0, total: 205.45 },
  };
  const store = { user: null, cart, setCart: vi.fn(), setQuantity: vi.fn(), refresh: vi.fn(), notify: vi.fn() };
  return { store, cart };
});

vi.mock("../store", () => ({ useStore: () => store }));
vi.mock("../api", async (orig) => ({
  ...(await orig()),
  api: { addresses: vi.fn().mockResolvedValue({ items: [] }), cart: vi.fn().mockResolvedValue(cart), placeOrder: vi.fn() },
}));

function LoginProbe() {
  const { state } = useLocation();
  return <p>login page, return to {state?.from}</p>;
}
const renderCheckout = () =>
  render(
    <MemoryRouter initialEntries={["/checkout"]}>
      <Routes>
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/cart" element={<p>cart page</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("Checkout > Pay Now", () => {
  beforeEach(() => store.notify.mockClear());

  it("sends a guest to the sign-in page and remembers to come back to checkout", async () => {
    store.user = { id: 5, isGuest: true, giftPoints: 0 };
    renderCheckout();
    await userEvent.click(await screen.findByRole("button", { name: "Pay Now" }));
    expect(await screen.findByText("login page, return to /checkout")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(store.notify).toHaveBeenCalledWith("Please sign in to complete your purchase", "info");
  });

  it("does not send a guest to sign in before they click Pay Now", async () => {
    store.user = { id: 5, isGuest: true, giftPoints: 0 };
    renderCheckout();
    expect(await screen.findByRole("heading", { name: "Grand Total" })).toBeInTheDocument();
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument();
  });

  it("lets a signed-in user continue: bad address is flagged, valid address opens the payment dialog", async () => {
    store.user = { id: 9, isGuest: false, giftPoints: 0, fullName: "Asha Rao" };
    renderCheckout();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Pay Now" }));
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Please fix the highlighted fields.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("First Name"), "Asha");
    await user.type(screen.getByLabelText("Last Name"), "Rao");
    await user.type(screen.getByLabelText("Address Line"), "12 MG Road");
    await user.type(screen.getByLabelText("Email"), "asha@example.com");
    await user.type(screen.getByLabelText("City"), "Pune");
    await user.type(screen.getByLabelText("PIN"), "411001");
    await user.type(screen.getByLabelText("Phone"), "9876543210");
    await user.type(screen.getByLabelText("State"), "Maharashtra");
    await user.click(screen.getByRole("button", { name: "Pay Now" }));
    expect(await screen.findByRole("dialog", { name: "Complete Payment" })).toBeInTheDocument();
  });
});
