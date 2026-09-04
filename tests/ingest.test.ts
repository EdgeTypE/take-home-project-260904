import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { submissionMetrics } from "../src/server/db/schema";
import { createCampaign, createSubmission, createUser, getMetric, insertMetric, resetDb, testDb } from "./helpers/db";
import { ingestDay } from "../src/server/services/ingest";

async function metricRowsFor(db: ReturnType<typeof testDb>, date: string) {
  return db
    .select()
    .from(submissionMetrics)
    .where(eq(submissionMetrics.capturedAt, date))
    .orderBy(submissionMetrics.submissionId);
}

describe("ingest", () => {
  beforeEach(async () => {
    await resetDb(testDb());
  });

  afterEach(async () => {
    await resetDb(testDb());
  });

  it("is idempotent: a same-day second run leaves the data unchanged", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db);
    const submission = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
    });

    const first = await ingestDay(db, "2026-01-15");
    const afterFirst = await metricRowsFor(db, "2026-01-15");

    const second = await ingestDay(db, "2026-01-15");
    const afterSecond = await metricRowsFor(db, "2026-01-15");

    expect(first.processed).toBe(1);
    expect(first.failed).toHaveLength(0);
    expect(afterSecond).toEqual(afterFirst);
    expect(afterSecond[0]?.views).toBeGreaterThanOrEqual(400);
  });

  it("only ever grows views from one day to the next", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db);
    const submission = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
    });

    await ingestDay(db, "2026-01-20");
    const dayOne = await getMetric(db, submission.id, "2026-01-20");

    await ingestDay(db, "2026-01-21");
    const dayTwo = await getMetric(db, submission.id, "2026-01-21");

    expect(dayTwo?.views).toBeGreaterThan(dayOne?.views ?? 0);
    expect(dayTwo?.likes).toBeGreaterThanOrEqual(dayOne?.likes ?? 0);
    expect(dayTwo?.comments).toBeGreaterThanOrEqual(dayOne?.comments ?? 0);
  });

  it("reports per-submission failures without stopping the rest", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db);
    const healthy = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
    });
    // This submission's previous metric sits at the int4 maximum, so the next
    // candidate value overflows and Postgres rejects the insert.
    const overflowing = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
    });
    await insertMetric(db, {
      submissionId: overflowing.id,
      date: "2026-02-01",
      views: 2_147_483_647,
      likes: 5,
      comments: 1,
    });

    const report = await ingestDay(db, "2026-02-02");

    expect(report.processed).toBe(2);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0]?.submissionId).toBe(overflowing.id);

    const healthyDay = await getMetric(db, healthy.id, "2026-02-02");
    expect(healthyDay).not.toBeNull();
    // The overflowing submission keeps its previous value untouched.
    const overflowDay = await getMetric(db, overflowing.id, "2026-02-02");
    expect(overflowDay).toBeNull();
  });
});
