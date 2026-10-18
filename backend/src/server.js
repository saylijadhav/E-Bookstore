import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool, query } from "./db.js";
import { log } from "./http.js";

const app = createApp();
const server = app.listen(config.PORT, config.HOST, () => {
  log("info", "listening", { host: config.HOST, port: config.PORT });
});

// Expired sessions are purged hourly.
const purge = setInterval(() => query("DELETE FROM sessions WHERE expires_at < now()").catch(() => {}), 3_600_000);
purge.unref();

const shutdown = () => {
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
