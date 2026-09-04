import { config } from "dotenv";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb, createPool, resolveDatabaseUrl } from "../src/server/db";

config({ path: ".env.local" });

async function main() {
  const pool = createPool(resolveDatabaseUrl());
  try {
    await migrate(createDb(pool), {
      migrationsFolder: resolve("src/server/db/migrations"),
    });
    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
