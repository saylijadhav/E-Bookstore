import { Router } from "express";
import { query } from "../db.js";
import { HttpError, idSchema, parse } from "../http.js";
import { requireUserOrGuest } from "../auth.js";
import { bookSelect, mapBook } from "../serializers.js";

const router = Router();

router.get("/wishlist", async (req, res, next) => {
  try {
    if (!req.user) return res.json({ items: [] });
    const { rows } = await query(
      `${bookSelect()} JOIN wishlist_items w ON w.book_id = b.id AND w.user_id = $1 ORDER BY w.created_at DESC`,
      [req.user.id],
    );
    res.json({ items: rows.map(mapBook) });
  } catch (err) {
    next(err);
  }
});

router.put("/wishlist/:bookId", requireUserOrGuest, async (req, res, next) => {
  try {
    const bookId = parse(idSchema, req.params.bookId);
    const exists = await query("SELECT 1 FROM books WHERE id = $1", [bookId]);
    if (!exists.rowCount) throw new HttpError(404, "NOT_FOUND", "Book not found");
    await query(
      "INSERT INTO wishlist_items (user_id, book_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [req.user.id, bookId],
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.delete("/wishlist/:bookId", async (req, res, next) => {
  try {
    const bookId = parse(idSchema, req.params.bookId);
    if (req.user) await query("DELETE FROM wishlist_items WHERE user_id=$1 AND book_id=$2", [req.user.id, bookId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/writers", async (req, res, next) => {
  try {
    if (!req.user) return res.json({ items: [] });
    const { rows } = await query(
      `SELECT a.id, a.name, a.bio, a.photo_url,
              (SELECT COUNT(*)::int FROM books b WHERE b.author_id = a.id) AS book_count
       FROM authors a JOIN followed_authors f ON f.author_id = a.id AND f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.id],
    );
    res.json({
      items: rows.map((r) => ({ id: r.id, name: r.name, bio: r.bio, photoUrl: r.photo_url, bookCount: r.book_count })),
    });
  } catch (err) {
    next(err);
  }
});

router.put("/writers/:authorId", requireUserOrGuest, async (req, res, next) => {
  try {
    const authorId = parse(idSchema, req.params.authorId);
    const exists = await query("SELECT 1 FROM authors WHERE id = $1", [authorId]);
    if (!exists.rowCount) throw new HttpError(404, "NOT_FOUND", "Writer not found");
    await query(
      "INSERT INTO followed_authors (user_id, author_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
      [req.user.id, authorId],
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.delete("/writers/:authorId", async (req, res, next) => {
  try {
    const authorId = parse(idSchema, req.params.authorId);
    if (req.user) await query("DELETE FROM followed_authors WHERE user_id=$1 AND author_id=$2", [req.user.id, authorId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
