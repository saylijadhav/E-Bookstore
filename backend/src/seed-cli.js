import crypto from "node:crypto";
import { pool } from "./db.js";
import { seed } from "./seed.js";

const demoPassword = process.env.DEMO_PASSWORD ?? crypto.randomBytes(9).toString("base64url");
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await seed(client, { demoPassword });
  await client.query("COMMIT");
  console.log("Seeded database.");
  console.log(`Demo login -> email: demo@bookworm.test  password: ${demoPassword}`);
} catch (err) {
  await client.query("ROLLBACK");
  console.error("Seed failed:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
