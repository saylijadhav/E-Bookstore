import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { HttpError, idSchema, parse } from "../http.js";
import { bookSelect, mapBook } from "../serializers.js";
import { requireRegistered } from "../auth.js";

const router = Router();

const FORMATS = ["paperback", "hardcover", "ebook", "audiobook"];

const listSchema = z.object({
  category: z.string().trim().max(60).optional(),
  q: z.string().trim().max(100).optional(),
  format: z.enum(FORMATS).optional(),
  language: z.string().trim().max(30).optional(),
  minPrice: z.coerce.number().min(0).max(1_000_000).optional(),
  maxPrice: z.coerce.number().min(0).max(1_000_000).optional(),
  authorId: idSchema.optional(),
  publisherId: idSchema.optional(),
  sort: z.enum(["relevance", "price_asc", "price_desc", "rating"]).default("relevance"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const SORTS = {
  relevance: "b.id ASC",
  price_asc: "b.price ASC, b.id ASC",
  price_desc: "b.price DESC, b.id ASC",
  rating: "rating DESC, review_count DESC, b.id ASC",
};

router.get("/books", async (req, res, next) => {
  try {
    const f = parse(listSchema, req.query);
    const where = [];
    const params = [];
    const add = (sql, value) => {
      params.push(value);
      where.push(sql.replace("?", `$${params.length}`));
    };

    if (f.category) add("c.slug = ?", f.category);
    if (f.format) add("b.format = ?", f.format);
    if (f.language) add("b.language = ?", f.language);
    if (f.minPrice != null) add("b.price >= ?", f.minPrice);
    if (f.maxPrice != null) add("b.price <= ?", f.maxPrice);
    if (f.authorId) add("b.author_id = ?", f.authorId);
    if (f.publisherId) add("b.publisher_id = ?", f.publisherId);
    if (f.q) {
      params.push(`%${escapeLike(f.q)}%`);
      where.push(`(b.title ILIKE $${params.length} OR a.name ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const total = (
      await query(
        `SELECT COUNT(*)::int AS n FROM books b
         JOIN authors a ON a.id = b.author_id JOIN categories c ON c.id = b.category_id ${whereSql}`,
        params,
      )
    ).rows[0].n;

    const { rows } = await query(
      `${bookSelect()} ${whereSql} ORDER BY ${SORTS[f.sort]} LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}`,
      params,
    );
    res.json({ items: rows.map(mapBook), page: f.page, pageSize: f.pageSize, total });
  } catch (err) {
    next(err);
  }
});

// Landing page rows: Recommended for You / Bestsellers this Month / New Launches.
router.get("/home", async (req, res, next) => {
  try {
    const limit = 4;
    let recommended = [];
    let personalised = false;

    if (req.user) {
      // Recommend unpurchased books from categories/authors the user has bought before.
      const r = await query(
        `${bookSelect()}
         WHERE b.id NOT IN (SELECT oi.book_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = $1)
           AND (b.category_id IN (SELECT b2.category_id FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN books b2 ON b2.id=oi.book_id WHERE o.user_id=$1)
             OR b.author_id   IN (SELECT b2.author_id   FROM order_items oi JOIN orders o ON o.id=oi.order_id JOIN books b2 ON b2.id=oi.book_id WHERE o.user_id=$1))
         ORDER BY rating DESC, review_count DESC, b.id LIMIT ${limit}`,
        [req.user.id],
      );
      recommended = r.rows;
      personalised = recommended.length > 0;
    }
    if (recommended.length === 0) {
      recommended = (await query(`${bookSelect()} ORDER BY rating DESC, review_count DESC, b.id LIMIT ${limit}`)).rows;
    }

    const bestsellers = (
      await query(
        `${bookSelect(`COALESCE(s.sold, 0) AS sold`)}
         LEFT JOIN (
           SELECT oi.book_id, SUM(oi.quantity)::int AS sold
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.status <> 'cancelled' AND o.created_at > now() - interval '30 days'
           GROUP BY oi.book_id
         ) s ON s.book_id = b.id
         ORDER BY sold DESC, review_count DESC, b.id LIMIT ${limit}`,
      )
    ).rows;

    const newLaunches = (await query(`${bookSelect()} ORDER BY b.created_at DESC, b.id DESC LIMIT ${limit}`)).rows;

    res.json({
      recommended: { personalised, items: recommended.map(mapBook) },
      bestsellers: bestsellers.map(mapBook),
      newLaunches: newLaunches.map(mapBook),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/books/:id", async (req, res, next) => {
  try {
    const id = parse(idSchema, req.params.id);
    const { rows } = await query(`${bookSelect()} WHERE b.id = $1`, [id]);
    if (!rows[0]) throw new HttpError(404, "NOT_FOUND", "Book not found");
    const book = rows[0];

    const [writer, breakdown, reviews, related, upsell] = await Promise.all([
      query("SELECT id, name, bio, photo_url FROM authors WHERE id = $1", [book.author_id]),
      query("SELECT rating, COUNT(*)::int AS n FROM reviews WHERE book_id = $1 GROUP BY rating", [id]),
      query(
        `SELECT r.id, COALESCE(u.full_name, 'Reader') AS user_name, r.rating, r.body, r.created_at
         FROM reviews r JOIN users u ON u.id = r.user_id
         WHERE r.book_id = $1 ORDER BY r.created_at DESC LIMIT 20`,
        [id],
      ),
      // Related: same category or same author.
      query(
        `${bookSelect()} WHERE b.id <> $1 AND (b.category_id = $2 OR b.author_id = $3)
         ORDER BY (b.author_id = $3) DESC, rating DESC, b.id LIMIT 4`,
        [id, book.category_id, book.author_id],
      ),
      // Cross-sell: what other buyers of this book also bought.
      query(
        `${bookSelect()}
         WHERE b.id IN (
           SELECT oi2.book_id FROM order_items oi1
           JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.book_id <> oi1.book_id
           WHERE oi1.book_id = $1)
         ORDER BY rating DESC, b.id LIMIT 4`,
        [id],
      ),
    ]);

    const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of breakdown.rows) ratingBreakdown[r.rating] = r.n;

    res.json({
      ...mapBook(book),
      stock: book.stock,
      writer: {
        id: writer.rows[0].id,
        name: writer.rows[0].name,
        bio: writer.rows[0].bio,
        photoUrl: writer.rows[0].photo_url,
      },
      ratingBreakdown,
      reviews: reviews.rows.map((r) => ({
        id: r.id,
        userName: r.user_name,
        rating: r.rating,
        body: r.body,
        createdAt: r.created_at,
      })),
      related: related.rows.map(mapBook),
      alsoBought: upsell.rows.map(mapBook),
    });
  } catch (err) {
    next(err);
  }
});

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(1000).default(""),
});

router.post("/books/:id/reviews", requireRegistered, async (req, res, next) => {
  try {
    const id = parse(idSchema, req.params.id);
    const { rating, body } = parse(reviewSchema, req.body);
    const exists = await query("SELECT 1 FROM books WHERE id = $1", [id]);
    if (!exists.rowCount) throw new HttpError(404, "NOT_FOUND", "Book not found");
    await query(
      `INSERT INTO reviews (book_id, user_id, rating, body) VALUES ($1,$2,$3,$4)
       ON CONFLICT (book_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body, created_at = now()`,
      [id, req.user.id, rating, body],
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get("/categories", async (_req, res, next) => {
  try {
    const { rows } = await query("SELECT id, name, slug FROM categories ORDER BY id");
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/publishers", async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.id, p.name, COUNT(b.id)::int AS book_count
       FROM publishers p LEFT JOIN books b ON b.publisher_id = p.id
       GROUP BY p.id ORDER BY p.name`,
    );
    res.json({ items: rows.map((r) => ({ id: r.id, name: r.name, bookCount: r.book_count })) });
  } catch (err) {
    next(err);
  }
});

router.get("/authors/:id", async (req, res, next) => {
  try {
    const id = parse(idSchema, req.params.id);
    const { rows } = await query("SELECT id, name, bio, photo_url FROM authors WHERE id = $1", [id]);
    if (!rows[0]) throw new HttpError(404, "NOT_FOUND", "Writer not found");
    const following = req.user
      ? (await query("SELECT 1 FROM followed_authors WHERE user_id=$1 AND author_id=$2", [req.user.id, id])).rowCount > 0
      : false;
    res.json({ id: rows[0].id, name: rows[0].name, bio: rows[0].bio, photoUrl: rows[0].photo_url, following });
  } catch (err) {
    next(err);
  }
});

export default router;
