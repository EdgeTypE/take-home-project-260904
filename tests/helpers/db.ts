import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { createDb, schema } from "../../src/server/db";
import { campaigns, submissionMetrics, submissions, users } from "../../src/server/db/schema";
import { platformFromUrl, type Platform } from "../../src/lib/platforms";
import { toDateOnly } from "../../src/lib/dates";

config({ path: ".env.test", quiet: true });

export type TestDb = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;

export function testPool(): Pool {
  if (!pool) {
    const url =
      process.env.TEST_DATABASE_URL ??
      "postgres://postgres:postgres@localhost:5432/clipping_test";
    pool = new Pool({ connectionString: url, max: 5 });
  }
  return pool;
}

export function testDb(): TestDb {
  return createDb(testPool());
}

export async function resetDb(db: TestDb): Promise<void> {
  await db.execute(
    sql`TRUNCATE TABLE "user", submission_metric, submission, campaign RESTART IDENTITY CASCADE`,
  );
}

const unique = () => Math.random().toString(36).slice(2, 10);

export async function createUser(
  db: TestDb,
  overrides: Partial<{ email: string; role: "admin" | "creator" }> = {},
) {
  const rows = await db
    .insert(users)
    .values({
      email: overrides.email ?? `user-${unique()}@example.test`,
      role: overrides.role ?? "creator",
    })
    .returning();
  return rows[0]!;
}

export interface CampaignOverrides {
  title?: string;
  platforms?: Platform[];
  payoutPer1kViewsCents?: number;
  totalBudgetCents?: number;
  status?: "draft" | "active" | "paused" | "completed";
  startsAt?: Date;
  endsAt?: Date;
  budgetSpentCents?: number;
}

export async function createCampaign(db: TestDb, overrides: CampaignOverrides = {}) {
  const now = new Date();
  const rows = await db
    .insert(campaigns)
    .values({
      title: overrides.title ?? `Campaign ${unique()}`,
      platforms: overrides.platforms ?? ["tiktok"],
      payoutPer1kViewsCents: overrides.payoutPer1kViewsCents ?? 500,
      totalBudgetCents: overrides.totalBudgetCents ?? 10_000,
      status: overrides.status ?? "active",
      startsAt: overrides.startsAt ?? new Date(now.getTime() - 86_400_000),
      endsAt: overrides.endsAt ?? new Date(now.getTime() + 14 * 86_400_000),
      budgetSpentCents: overrides.budgetSpentCents ?? 0,
    })
    .returning();
  return rows[0]!;
}

export interface SubmissionOverrides {
  campaignId: string;
  creatorId: string;
  postUrl?: string;
  platform?: Platform;
  status?: "pending" | "approved" | "rejected" | "paid";
}

export async function createSubmission(
  db: TestDb,
  overrides: SubmissionOverrides,
) {
  const postUrl = overrides.postUrl ?? `https://www.tiktok.com/@maker/video/${unique()}`;
  const rows = await db
    .insert(submissions)
    .values({
      campaignId: overrides.campaignId,
      creatorId: overrides.creatorId,
      postUrl,
      platform: overrides.platform ?? platformFromUrl(postUrl) ?? "tiktok",
      status: overrides.status ?? "pending",
    })
    .returning();
  return rows[0]!;
}

export async function insertMetric(
  db: TestDb,
  input: {
    submissionId: string;
    date: string | Date;
    views: number;
    likes?: number;
    comments?: number;
  },
) {
  const date = typeof input.date === "string" ? input.date : toDateOnly(input.date);
  const rows = await db
    .insert(submissionMetrics)
    .values({
      submissionId: input.submissionId,
      capturedAt: date,
      views: input.views,
      likes: input.likes ?? 0,
      comments: input.comments ?? 0,
    })
    .returning();
  return rows[0]!;
}

export async function getMetric(db: TestDb, submissionId: string, date: string) {
  const rows = await db
    .select()
    .from(submissionMetrics)
    .where(
      sql`${submissionMetrics.submissionId} = ${submissionId} AND ${submissionMetrics.capturedAt} = ${date}`,
    );
  return rows[0] ?? null;
}
