import crypto from "node:crypto";
import { config } from "./config.js";
import { query } from "./db.js";
import { HttpError } from "./http.js";

export const COOKIE = "bw_session";
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: "lax",
  path: "/",
  maxAge: config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
});

export async function startSession(res, userId, db = { query }) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [sha256(token), userId, config.SESSION_TTL_DAYS],
  );
  res.cookie(COOKIE, token, cookieOptions());
}

export async function endSession(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
  res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
}

export const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  fullName: u.full_name,
  isGuest: u.is_guest,
  giftPoints: u.gift_points,
});

// Loads req.user from the session cookie when present (does not create anything).
export async function loadUser(req, _res, next) {
  try {
    const token = req.cookies?.[COOKIE];
    if (typeof token === "string" && token.length >= 40 && token.length <= 64) {
      const { rows } = await query(
        `SELECT u.id, u.email, u.full_name, u.is_guest, u.gift_points, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > now()`,
        [sha256(token)],
      );
      req.user = rows[0] ?? null;
    } else {
      req.user = null;
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Guest checkout: shopper actions work without an account by lazily creating a guest user.
export async function requireUserOrGuest(req, res, next) {
  try {
    if (!req.user) {
      const { rows } = await query(
        "INSERT INTO users (is_guest) VALUES (TRUE) RETURNING id, email, full_name, is_guest, gift_points, role",
      );
      await startSession(res, rows[0].id);
      req.user = rows[0];
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRegistered(req, _res, next) {
  if (!req.user || req.user.is_guest) {
    return next(new HttpError(401, "UNAUTHENTICATED", "Please sign in"));
  }
  next();
}

// CSRF defence in depth on top of SameSite=Lax: state-changing requests must come from an allowed Origin.
export function originCheck(req, _res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin && !config.CORS_ORIGINS.includes(origin)) {
    return next(new HttpError(403, "FORBIDDEN", "Origin not allowed"));
  }
  next();
}
