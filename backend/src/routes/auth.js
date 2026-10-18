import { Router } from "express";
import argon2 from "argon2";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { tx, query } from "../db.js";
import { HttpError, parse } from "../http.js";
import { config } from "../config.js";
import { endSession, publicUser, startSession } from "../auth.js";

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new HttpError(429, "RATE_LIMITED", "Too many attempts, try again later")),
});

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(100),
  password: z.string().min(10, "At least 10 characters").max(128),
  fullName: z.string().trim().min(1).max(100),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(100),
  password: z.string().min(1).max(128),
});

// A real hash to compare against when the email is unknown, so timing does not reveal account existence.
const DUMMY_HASH = await argon2.hash("not-a-real-password", { type: argon2.argon2id });

router.get("/me", (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { email, password, fullName } = parse(registerSchema, req.body);
    const hash = await argon2.hash(password, { type: argon2.argon2id });

    const user = await tx(async (db) => {
      const taken = await db.query("SELECT 1 FROM users WHERE email = $1", [email]);
      if (taken.rowCount) throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists");

      // Upgrade the current guest in place so the cart and orders carry over.
      if (req.user?.is_guest) {
        const { rows } = await db.query(
          `UPDATE users SET email=$1, password_hash=$2, full_name=$3, is_guest=FALSE,
                  gift_points = gift_points + $4
           WHERE id=$5 RETURNING id, email, full_name, is_guest, gift_points`,
          [email, hash, fullName, config.WELCOME_POINTS, req.user.id],
        );
        return rows[0];
      }
      const { rows } = await db.query(
        `INSERT INTO users (email, password_hash, full_name, gift_points)
         VALUES ($1,$2,$3,$4) RETURNING id, email, full_name, is_guest, gift_points`,
        [email, hash, fullName, config.WELCOME_POINTS],
      );
      await startSession(res, rows[0].id, db);
      return rows[0];
    });
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = parse(loginSchema, req.body);
    const { rows } = await query(
      "SELECT id, email, full_name, is_guest, gift_points, password_hash FROM users WHERE email = $1",
      [email],
    );
    const found = rows[0];
    const ok = await argon2.verify(found?.password_hash ?? DUMMY_HASH, password).catch(() => false);
    if (!found || !ok) throw new HttpError(401, "INVALID_CREDENTIALS", "Incorrect email or password");

    // Merge a guest cart into the account cart, then drop the guest.
    await tx(async (db) => {
      if (req.user?.is_guest && req.user.id !== found.id) {
        await db.query(
          `INSERT INTO cart_items (user_id, book_id, quantity)
           SELECT $1, book_id, quantity FROM cart_items WHERE user_id = $2
           ON CONFLICT (user_id, book_id)
           DO UPDATE SET quantity = LEAST(20, cart_items.quantity + EXCLUDED.quantity), updated_at = now()`,
          [found.id, req.user.id],
        );
        await db.query("DELETE FROM users WHERE id = $1 AND is_guest AND NOT EXISTS (SELECT 1 FROM orders WHERE user_id = $1)", [req.user.id]);
      }
      await startSession(res, found.id, db);
    });
    res.json({ user: publicUser(found) });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    await endSession(req, res);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
