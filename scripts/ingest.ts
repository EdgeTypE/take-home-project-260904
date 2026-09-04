import { config } from "dotenv";
import { createDb, createPool, resolveDatabaseUrl } from "../src/server/db";
import { ingestDay } from "../src/server/services/ingest";
import { todayUtc } from "../src/lib/dates";

config({ path: ".env.local" });

async function main() {
  const pool = createPool(resolveDatabaseUrl());
  const db = createDb(pool);
  try {
    const report = await ingestDay(db, todayUtc());
    console.log(`ingest ${report.date}: processed ${report.processed} submissions`);
    if (report.failed.length === 0) {
      console.log("no failures");
    } else {
      console.log(`${report.failed.length} failure(s):`);
      for (const failure of report.failed) {
        console.log(`  ${failure.submissionId}: ${failure.error}`);
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
