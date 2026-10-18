import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Auth from "../pages/Auth";

const { store } = vi.hoisted(() => ({
  store: { setUser: vi.fn(), refresh: vi.fn().mockResolvedValue(), notify: vi.fn() },
}));
vi.mock("../store", () => ({ useStore: () => store }));

const renderAuth = (mode) =>
  render(
    <MemoryRouter>
      <Auth mode={mode} />
    </MemoryRouter>,
  );

describe.each(["login", "register"])("Auth (%s) password visibility", (mode) => {
  it("hides the password by default and toggles it with the eye button", async () => {
    renderAuth(mode);
    const user = userEvent.setup();
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await user.type(input, "a-strong-pass-1");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("a-strong-pass-1");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("does not submit the form when the eye button is clicked", async () => {
    renderAuth(mode);
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
