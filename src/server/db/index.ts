import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/clipping_dev";

export function resolveDatabaseUrl(envKey: string = "DATABASE_URL"): string {
  return process.env[envKey] ?? DEFAULT_DATABASE_URL;
}

export function createPool(url: string): Pool {
  return new Pool({ connectionString: url, max: 10 });
}

export function createDb(pool: Pool): NodePgDatabase<typeof schema> {
  return drizzle(pool, { schema });
}

// Next.js dev hot-reload creates modules repeatedly; cache the pool globally
// so route handlers do not exhaust connections.
const globalForDb = globalThis as unknown as {
  pool?: Pool;
  db?: NodePgDatabase<typeof schema>;
};

export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalForDb.pool) {
    const pool = createPool(resolveDatabaseUrl());
    globalForDb.pool = pool;
    globalForDb.db = createDb(pool);
  }
  return globalForDb.db!;
}

export { schema };
