import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import BookCard from "../components/BookCard";
import { deliveryLabel, formatINR } from "../api";

const book = {
  id: 1,
  title: "Joy of Minimalism",
  author: { id: 7, name: "Daniel Reed" },
  category: "Self-help",
  format: "paperback",
  tags: ["Non-fiction", "Self-help"],
  description: "Declutter your life.",
  price: 149,
  rating: 4.5,
  reviewCount: 145,
  estimatedDelivery: "2026-07-21",
};

describe("formatting helpers", () => {
  it("formats rupees with Indian digit grouping", () => {
    expect(formatINR(149)).toBe("₹149");
    expect(formatINR(125000)).toBe("₹1,25,000");
    expect(formatINR(99.5)).toBe("₹99.50");
  });

  it("builds the delivery label, or says instant for digital books", () => {
    expect(deliveryLabel(book)).toMatch(/^Delivery by \w{3} 21 Jul$/);
    expect(deliveryLabel({ estimatedDelivery: null })).toBe("Instant download");
  });
});

describe("BookCard", () => {
  it("shows title, author link, format, tags, price and delivery", () => {
    render(<MemoryRouter><BookCard book={book} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Joy of Minimalism" })).toHaveAttribute("href", "/books/1");
    expect(screen.getByRole("link", { name: "by Daniel Reed" })).toHaveAttribute("href", "/?authorId=7");
    expect(screen.getByText("Paperback")).toBeInTheDocument();
    expect(screen.getByText("Non-fiction")).toBeInTheDocument();
    expect(screen.getByText("₹149")).toBeInTheDocument();
    expect(screen.getByText(/Delivery by/)).toBeInTheDocument();
  });
});
