import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "../src/server/db";
import { campaigns, submissionMetrics, submissions, users } from "../src/server/db/schema";
import { toDateOnly } from "../src/lib/dates";
import type { Platform } from "../src/lib/platforms";

type Db = NodePgDatabase<typeof schema>;

const DAY_MS = 86_400_000;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * DAY_MS);
}

async function insertUser(
  db: Db,
  email: string,
  role: "admin" | "creator",
) {
  const rows = await db.insert(users).values({ email, role }).returning();
  return rows[0]!;
}

async function insertCampaign(
  db: Db,
  input: {
    title: string;
    platforms: Platform[];
    payoutPer1kViewsCents: number;
    totalBudgetCents: number;
    status: "draft" | "active" | "paused" | "completed";
    startsAt: Date;
    endsAt: Date;
    budgetSpentCents?: number;
  },
) {
  const rows = await db
    .insert(campaigns)
    .values({
      title: input.title,
      platforms: input.platforms,
      payoutPer1kViewsCents: input.payoutPer1kViewsCents,
      totalBudgetCents: input.totalBudgetCents,
      status: input.status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      budgetSpentCents: input.budgetSpentCents ?? 0,
    })
    .returning();
  return rows[0]!;
}

async function insertSubmission(
  db: Db,
  input: {
    campaignId: string;
    creatorId: string;
    postUrl: string;
    platform: Platform;
    status: "pending" | "approved" | "rejected" | "paid";
    rejectionReason?: string;
  },
) {
  const rows = await db
    .insert(submissions)
    .values({
      campaignId: input.campaignId,
      creatorId: input.creatorId,
      postUrl: input.postUrl,
      platform: input.platform,
      status: input.status,
      rejectionReason: input.rejectionReason,
    })
    .returning();
  return rows[0]!;
}

/** Fill a growing daily views history for a submission, ending today. */
async function insertHistory(
  db: Db,
  submissionId: string,
  days: number,
  fromViews: number,
  toViews: number,
) {
  for (let i = 0; i < days; i++) {
    const progress = days === 1 ? 1 : i / (days - 1);
    const views = Math.round(fromViews + (toViews - fromViews) * progress);
    await db.insert(submissionMetrics).values({
      submissionId,
      capturedAt: toDateOnly(daysFromNow(i - (days - 1))),
      views,
      likes: Math.round(views / 20),
      comments: Math.round(views / 120),
    });
  }
}

async function insertMetricToday(
  db: Db,
  submissionId: string,
  views: number,
) {
  await db.insert(submissionMetrics).values({
    submissionId,
    capturedAt: toDateOnly(new Date()),
    views,
    likes: Math.round(views / 20),
    comments: Math.round(views / 120),
  });
}

export async function seedDatabase(db: Db): Promise<void> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "admin@demo.dev"))
    .limit(1);
  if (existing.length > 0) {
    console.log("seed skipped: admin@demo.dev already exists (run pnpm db:reset for a fresh demo)");
    return;
  }

  const admin = await insertUser(db, "admin@demo.dev", "admin");
  const alice = await insertUser(db, "alice@demo.dev", "creator");
  const bob = await insertUser(db, "bob@demo.dev", "creator");

  // 1) Completed campaign: two approved clips exhausted the budget and one
  //    creator got rejected with a reason. Good for status filters.
  const completed = await insertCampaign(db, {
    title: "Spring Reels Launch",
    platforms: ["instagram", "youtube"],
    payoutPer1kViewsCents: 500,
    totalBudgetCents: 2000,
    status: "completed",
    startsAt: daysFromNow(-14),
    endsAt: daysFromNow(-1),
    budgetSpentCents: 2000,
  });
  const completedAlice = await insertSubmission(db, {
    campaignId: completed.id,
    creatorId: alice.id,
    postUrl: "https://www.instagram.com/reel/SpringLaunchAlice1/",
    platform: "instagram",
    status: "paid",
  });
  const completedBob = await insertSubmission(db, {
    campaignId: completed.id,
    creatorId: bob.id,
    postUrl: "https://www.youtube.com/shorts/SpringLaunchBob1",
    platform: "youtube",
    status: "approved",
  });
  await insertSubmission(db, {
    campaignId: completed.id,
    creatorId: bob.id,
    postUrl: "https://www.youtube.com/watch?v=SpringLaunchReject1",
    platform: "youtube",
    status: "rejected",
    rejectionReason: "Off brief: the clip does not feature the product",
  });
  await insertHistory(db, completedAlice.id, 10, 900, 2500);
  await insertHistory(db, completedBob.id, 10, 600, 2500);

  // 2) Active campaign with one approved clip and two pending ones, staged so
  //    the demo tells the whole budget story in two clicks. The approved clip
  //    already spent $20 of the $30 budget, leaving $10. Alice's pending clip
  //    costs exactly $10 (fills the budget -> campaign completes on its own),
  //    Bob's costs $30 (approval must fail with a typed over-budget error).
  const active = await insertCampaign(db, {
    title: "Summer Drop Teaser",
    platforms: ["tiktok"],
    payoutPer1kViewsCents: 500,
    totalBudgetCents: 3000,
    status: "active",
    startsAt: daysFromNow(-3),
    endsAt: daysFromNow(9),
    budgetSpentCents: 2000,
  });
  const approvedClip = await insertSubmission(db, {
    campaignId: active.id,
    creatorId: alice.id,
    postUrl: "https://www.tiktok.com/@alice/video/7123456789012345601",
    platform: "tiktok",
    status: "approved",
  });
  const pendingAlice = await insertSubmission(db, {
    campaignId: active.id,
    creatorId: alice.id,
    postUrl: "https://www.tiktok.com/@alice/video/7123456789012345602",
    platform: "tiktok",
    status: "pending",
  });
  const pendingBob = await insertSubmission(db, {
    campaignId: active.id,
    creatorId: bob.id,
    postUrl: "https://www.tiktok.com/@bob/video/7123456789012345603",
    platform: "tiktok",
    status: "pending",
  });
  // Grows to 4,000 views by today: at approval time it paid 4 x $5 = $20.
  await insertHistory(db, approvedClip.id, 4, 1000, 4000);
  await insertMetricToday(db, pendingAlice.id, 2000); // costs 1000, exactly the $10 left
  await insertMetricToday(db, pendingBob.id, 6000); // costs 3000, over the $10 left

  // 3) Fresh active campaign with no submissions yet: the creator submit demo.
  await insertCampaign(db, {
    title: "Fresh Creator Week",
    platforms: ["tiktok", "instagram", "youtube"],
    payoutPer1kViewsCents: 300,
    totalBudgetCents: 5000,
    status: "active",
    startsAt: daysFromNow(-1),
    endsAt: daysFromNow(12),
  });

  console.log("seed complete:");
  console.log(`  admin:    ${admin.email}`);
  console.log(`  creators: ${alice.email}, ${bob.email}`);
  console.log("  campaigns: 1 completed (paid/rejected history), 1 active budget demo, 1 fresh");
}
