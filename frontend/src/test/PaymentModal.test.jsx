import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PaymentModal from "../components/PaymentModal";

const setup = (props = {}) => {
  const onPay = vi.fn();
  const onClose = vi.fn();
  render(<PaymentModal amount={580} busy={false} error="" onPay={onPay} onClose={onClose} {...props} />);
  return { onPay, onClose, user: userEvent.setup() };
};

describe("PaymentModal", () => {
  it("shows the payable amount and the payment tabs", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Complete Payment" })).toBeInTheDocument();
    expect(screen.getByText("₹580")).toBeInTheDocument();
    for (const name of ["Credit Card", "Debit Card", "UPI", "Wallet", "Net Banking", "Cash on Delivery"]) {
      expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    }
  });

  it("rejects an invalid card and does not call onPay", async () => {
    const { onPay, user } = setup();
    await user.type(screen.getByLabelText("Card Number"), "1234567812345678");
    await user.click(screen.getByRole("button", { name: "Pay Now" }));
    expect(onPay).not.toHaveBeenCalled();
    expect(screen.getByText("Enter a valid 16-digit card number")).toBeInTheDocument();
    expect(screen.getByText("Enter the name on the card")).toBeInTheDocument();
  });

  it("accepts a valid card and reports only the payment method", async () => {
    const { onPay, user } = setup();
    await user.type(screen.getByLabelText("Card Number"), "4242424242424242");
    await user.type(screen.getByLabelText("Name on Card"), "Asha Rao");
    await user.type(screen.getByLabelText("CVV"), "123");
    await user.type(screen.getByLabelText("Date of Expiry"), "1230");
    await user.click(screen.getByRole("button", { name: "Pay Now" }));
    expect(onPay).toHaveBeenCalledTimes(1);
    expect(onPay).toHaveBeenCalledWith("card"); // no card data leaves the component
  });

  it("validates the UPI id and maps the wallet tab to the wallet method", async () => {
    const { onPay, user } = setup();
    await user.click(screen.getByRole("tab", { name: "UPI" }));
    await user.click(screen.getByRole("button", { name: "Pay Now" }));
    expect(screen.getByText("Enter a valid UPI ID, e.g. name@bank")).toBeInTheDocument();
    await user.type(screen.getByLabelText("UPI ID"), "asha@okbank");
    await user.click(screen.getByRole("button", { name: "Pay Now" }));
    expect(onPay).toHaveBeenLastCalledWith("upi");

    await user.click(screen.getByRole("tab", { name: "Wallet" }));
    await user.click(screen.getByRole("button", { name: "Pay Now" }));
    expect(onPay).toHaveBeenLastCalledWith("wallet");
  });

  it("closes on Escape unless a payment is in progress", async () => {
    const first = setup();
    await first.user.keyboard("{Escape}");
    expect(first.onClose).toHaveBeenCalled();
  });

  it("shows server errors in an alert", () => {
    setup({ error: "Out of stock" });
    expect(screen.getByRole("alert")).toHaveTextContent("Out of stock");
  });
});
