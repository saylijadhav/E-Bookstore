import { z } from "zod";
import { config } from "./config.js";

export function log(level, msg, extra = {}) {
  if (config.isTest && level !== "error") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra });
  (level === "error" ? console.error : console.log)(line);
}

export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const idSchema = z.coerce.number().int().positive().max(2_000_000_000);

export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) fields[issue.path.join(".") || "_"] = issue.message;
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid request", fields);
  }
  return result.data;
}

export function requestLog(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    log("info", "request", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Number((process.hrtime.bigint() - start) / 1_000_000n),
      user: req.user?.id ?? null,
    });
  });
  next();
}

// Never leaks internals: unknown errors become a generic 500, details go to the server log only.
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, fields: err.fields } });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Malformed JSON body" } });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" } });
  }
  log("error", "unhandled", { path: req.path, error: err?.message, stack: err?.stack });
  res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
}
