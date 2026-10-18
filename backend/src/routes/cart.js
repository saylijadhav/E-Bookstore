import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { HttpError, idSchema, parse } from "../http.js";
import { requireUserOrGuest } from "../auth.js";
import { buildCart } from "../cartService.js";
import { isPhysical } from "../serializers.js";

const router = Router();

const getSchema = z.object({
  coupon: z.string().trim().max(20).optional(),
  usePoints: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
const postSchema = z.object({
  bookId: idSchema,
  quantity: z.coerce.number().int().min(0).max(20),
});

router.get("/cart", async (req, res, next) => {
  try {
    const { coupon, usePoints } = parse(getSchema, req.query);
    if (!req.user) {
      return res.json({
        items: [],
        totals: { subtotal: 0, discount: 0, tax: 0, shippingFee: 0, pointsRedeemed: 0, pointsEarned: 0, total: 0, currency: "INR", couponCode: null },
        couponError: null,
        giftPointsAvailable: 0,
      });
    }
    res.json(await buildCart(req.user, { couponCode: coupon, usePoints }));
  } catch (err) {
    next(err);
  }
});

router.post("/cart", requireUserOrGuest, async (req, res, next) => {
  try {
    const { bookId, quantity } = parse(postSchema, req.body);
    const { rows } = await query("SELECT id, title, format, stock FROM books WHERE id = $1", [bookId]);
    const book = rows[0];
    if (!book) throw new HttpError(404, "NOT_FOUND", "Book not found");
    if (quantity > 0 && isPhysical(book.format) && quantity > book.stock) {
      throw new HttpError(409, "OUT_OF_STOCK", `Only ${book.stock} in stock`);
    }
    if (quantity === 0) {
      await query("DELETE FROM cart_items WHERE user_id = $1 AND book_id = $2", [req.user.id, bookId]);
    } else {
      await query(
        `INSERT INTO cart_items (user_id, book_id, quantity) VALUES ($1,$2,$3)
         ON CONFLICT (user_id, book_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`,
        [req.user.id, bookId, quantity],
      );
    }
    res.json(await buildCart(req.user));
  } catch (err) {
    next(err);
  }
});

export default router;
