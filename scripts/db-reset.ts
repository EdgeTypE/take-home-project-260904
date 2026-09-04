import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb, createPool, resolveDatabaseUrl } from "../src/server/db";
import { seedDatabase } from "./db-seed";

config({ path: ".env.local" });

async function main() {
  const pool = createPool(resolveDatabaseUrl());
  const db = createDb(pool);
  try {
    // Drizzle keeps its journal in a separate "drizzle" schema, so dropping
    // public alone would leave it thinking migrations are already applied.
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    console.log("dropped and recreated the public schema");

    await migrate(db, {
      migrationsFolder: fileURLToPath(
        new URL("../src/server/db/migrations", import.meta.url),
      ),
    });
    console.log("migrations applied");

    await seedDatabase(db);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
