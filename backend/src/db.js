import pg from "pg";
import { config } from "./config.js";

pg.types.setTypeParser(20, Number); // int8 -> number (ids are well below 2^53)
pg.types.setTypeParser(1700, Number); // numeric -> number (money converted to integer paise before math)
pg.types.setTypeParser(1082, (v) => v); // date -> "YYYY-MM-DD" string, no timezone shifting

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 10_000,
  ssl: config.isProd ? { rejectUnauthorized: true } : false,
});

export const query = (text, params) => pool.query(text, params);

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
