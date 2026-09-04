import { config } from "dotenv";
import { createDb, createPool, resolveDatabaseUrl } from "../src/server/db";
import { seedDatabase } from "./db-seed";

config({ path: ".env.local" });

async function main() {
  const pool = createPool(resolveDatabaseUrl());
  try {
    await seedDatabase(createDb(pool));
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
