import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../src/server/trpc/routers/_app";
import { createCampaign, createSubmission, createUser, insertMetric, resetDb, testDb } from "./helpers/db";
import type { TestDb } from "./helpers/db";
import type { User } from "../src/server/db/schema";

async function overviewAsAdmin(db: TestDb, admin: User, campaignId: string) {
  return appRouter.createCaller({ db, user: admin, setCookie: () => {} }).campaign.overview({
    id: campaignId,
  });
}

describe("campaign.overview", () => {
  beforeEach(async () => {
    await resetDb(testDb());
  });

  afterEach(async () => {
    await resetDb(testDb());
  });

  it("zero-fills every day of the campaign period, including days without metrics", async () => {
    const db = testDb();
    const admin = await createUser(db, { role: "admin" });
    const creator = await createUser(db);
    const startsAt = new Date("2026-03-01T00:00:00Z");
    const endsAt = new Date("2026-03-05T00:00:00Z");
    const campaign = await createCampaign(db, { startsAt, endsAt });
    const submission = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
      status: "approved",
    });
    await insertMetric(db, { submissionId: submission.id, date: "2026-03-01", views: 1000 });
    await insertMetric(db, { submissionId: submission.id, date: "2026-03-03", views: 2500 });

    const overview = await overviewAsAdmin(db, admin, campaign.id);

    expect(overview.series.map((day) => day.date)).toEqual([
      "2026-03-01",
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
    ]);
    expect(overview.series.map((day) => day.views)).toEqual([1000, 0, 2500, 0, 0]);
    expect(overview.approvedViews).toBe(2500);
    expect(overview.budgetLeftCents).toBe(campaign.totalBudgetCents);
  });

  it("ignores pending submissions in the totals", async () => {
    const db = testDb();
    const admin = await createUser(db, { role: "admin" });
    const creator = await createUser(db);
    const campaign = await createCampaign(db);
    const pending = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    await insertMetric(db, { submissionId: pending.id, date: "2026-01-10", views: 9999 });

    const overview = await overviewAsAdmin(db, admin, campaign.id);

    expect(overview.approvedViews).toBe(0);
  });
});
