import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { errorHandler, HttpError, requestLog } from "./http.js";
import { loadUser, originCheck } from "./auth.js";
import authRoutes from "./routes/auth.js";
import catalogueRoutes from "./routes/catalogue.js";
import cartRoutes from "./routes/cart.js";
import libraryRoutes from "./routes/library.js";
import orderRoutes from "./routes/orders.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: "20kb" }));
  app.use(cookieParser());
  app.use(requestLog);
  app.use(
    "/api",
    rateLimit({
      windowMs: 60 * 1000,
      limit: config.isTest ? 100_000 : 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      handler: (_req, _res, next) => next(new HttpError(429, "RATE_LIMITED", "Too many requests")),
    }),
  );

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", originCheck, loadUser);
  app.use("/api/auth", authRoutes);
  app.use("/api", catalogueRoutes);
  app.use("/api", cartRoutes);
  app.use("/api", libraryRoutes);
  app.use("/api", orderRoutes);

  app.use("/api", (_req, _res, next) => next(new HttpError(404, "NOT_FOUND", "Not found")));
  app.use(errorHandler);
  return app;
}
