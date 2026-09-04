import { defineConfig } from "drizzle-kit";

const url =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/clipping_dev";

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
