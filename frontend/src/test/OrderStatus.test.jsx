import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill, statusLabel } from "../pages/Orders";

describe("order status shown to customers", () => {
  it("shows a placed cash-on-delivery order as a success, not as pending", () => {
    const order = { status: "pending", paymentMethod: "cod" };
    expect(statusLabel(order)).toBe("Order placed · Pay on delivery");
    render(<StatusPill order={order} />);
    const pill = screen.getByText("Order placed · Pay on delivery");
    expect(pill).toHaveClass("text-emerald-300");
    expect(screen.queryByText(/pending/i)).not.toBeInTheDocument();
  });

  it("shows prepaid orders as Paid", () => {
    for (const paymentMethod of ["upi", "card", "netbanking", "wallet"]) {
      expect(statusLabel({ status: "paid", paymentMethod })).toBe("Paid");
    }
  });

  it("still shows cancelled orders as a warning and other states by name", () => {
    render(<StatusPill order={{ status: "cancelled", paymentMethod: "upi" }} />);
    expect(screen.getByText("Cancelled")).toHaveClass("text-red-300");
    expect(statusLabel({ status: "shipped", paymentMethod: "cod" })).toBe("Shipped");
    expect(statusLabel({ status: "delivered", paymentMethod: "cod" })).toBe("Delivered");
  });
});
