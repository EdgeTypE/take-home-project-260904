import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { Client } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb, createPool } from "../src/server/db";

config({ path: ".env.test", quiet: true });

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/clipping_test";

export default async function setup() {
  const target = new URL(TEST_DATABASE_URL);
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  if (!/^[a-z_][a-z0-9_]*$/i.test(databaseName)) {
    throw new Error(`Unsafe test database name: ${databaseName}`);
  }

  // Connect to the maintenance database and create the test one if missing.
  const maintenance = new URL(TEST_DATABASE_URL);
  maintenance.pathname = "/postgres";
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const exists = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );
    if (exists.rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await client.end();
  }

  // Apply the committed migrations (same code path pnpm db:migrate uses), so
  // tests always exercise exactly what is checked into the repo.
  const pool = createPool(TEST_DATABASE_URL);
  try {
    await migrate(createDb(pool), {
      migrationsFolder: fileURLToPath(
        new URL("../src/server/db/migrations", import.meta.url),
      ),
    });
  } finally {
    await pool.end();
  }
}
