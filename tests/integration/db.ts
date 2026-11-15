import "dotenv/config";
import { Client } from "pg";

/** True when DATABASE_URL points to a reachable PostgreSQL server. Integration tests skip otherwise. */
export async function isDatabaseAvailable(): Promise<boolean> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return false;
  const client = new Client({ connectionString, connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

export const DB_AVAILABLE = await isDatabaseAvailable();

if (!DB_AVAILABLE) {
  console.warn("[integration] PostgreSQL not reachable via DATABASE_URL — integration tests are BLOCKED (skipped).");
}
