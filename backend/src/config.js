import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  CORS_ORIGIN: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const env = schema.parse(process.env);

export const config = {
  ...env,
  CORS_ORIGINS: env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
  isProd: env.NODE_ENV === "production",
  isTest: env.NODE_ENV === "test",
  SESSION_TTL_DAYS: 7,
  WELCOME_POINTS: 100,
};
