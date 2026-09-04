import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { campaigns, submissions } from "../src/server/db/schema";
import {
  createCampaign,
  createSubmission,
  createUser,
  insertMetric,
  resetDb,
  testDb,
} from "./helpers/db";
import {
  approveSubmission,
  rejectSubmission,
} from "../src/server/services/approval";
import {
  AlreadyReviewedError,
  BudgetExceededError,
} from "../src/server/services/errors";

describe("budget ceiling and approvals", () => {
  beforeEach(async () => {
    await resetDb(testDb());
  });

  afterEach(async () => {
    await resetDb(testDb());
  });

  it("approves and charges exactly floor(views / 1000) * payout", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db, {
      payoutPer1kViewsCents: 500,
      totalBudgetCents: 10_000,
    });
    const submission = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    await insertMetric(db, { submissionId: submission.id, date: "2026-01-10", views: 2500 });

    const result = await approveSubmission(db, submission.id);

    expect(result.payoutCents).toBe(1000);
    expect(result.budgetSpentCents).toBe(1000);
    expect(result.budgetLeftCents).toBe(9000);
    expect(result.campaignCompleted).toBe(false);

    const [stored] = await db
      .select({ status: submissions.status, updatedAt: submissions.updatedAt })
      .from(submissions)
      .where(eq(submissions.id, submission.id));
    expect(stored?.status).toBe("approved");
  });

  it("fills the budget to zero and completes the campaign on its own", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db, {
      payoutPer1kViewsCents: 500,
      totalBudgetCents: 500,
    });
    const submission = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    await insertMetric(db, { submissionId: submission.id, date: "2026-01-10", views: 1000 });

    const result = await approveSubmission(db, submission.id);

    expect(result.payoutCents).toBe(500);
    expect(result.budgetLeftCents).toBe(0);
    expect(result.campaignCompleted).toBe(true);

    const [campaignRow] = await db
      .select({ status: campaigns.status })
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id));
    expect(campaignRow?.status).toBe("completed");
  });

  it("rejects the next approval once the budget is exhausted", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db, {
      payoutPer1kViewsCents: 500,
      totalBudgetCents: 500,
    });
    const first = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    const second = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    await insertMetric(db, { submissionId: first.id, date: "2026-01-10", views: 1000 });
    await insertMetric(db, { submissionId: second.id, date: "2026-01-10", views: 1000 });

    await approveSubmission(db, first.id);

    await expect(approveSubmission(db, second.id)).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
    const [spentRow] = await db
      .select({ spent: campaigns.budgetSpentCents })
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id));
    expect(spentRow?.spent).toBe(500);
  });

  it("lets only one of two parallel approvals through when the budget covers one", async () => {
    const db = testDb();
    const creator = await createUser(db);
    // Budget 1500 covers one 1000-cent approval but not two.
    const campaign = await createCampaign(db, {
      payoutPer1kViewsCents: 500,
      totalBudgetCents: 1500,
    });
    const first = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    const second = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    await insertMetric(db, { submissionId: first.id, date: "2026-01-10", views: 2000 });
    await insertMetric(db, { submissionId: second.id, date: "2026-01-10", views: 2000 });

    const results = await Promise.allSettled([
      approveSubmission(db, first.id),
      approveSubmission(db, second.id),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(BudgetExceededError);
      expect((rejected[0].reason as BudgetExceededError).remainingCents).toBe(500);
    }

    const [spentRow] = await db
      .select({ spent: campaigns.budgetSpentCents })
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id));
    expect(spentRow?.spent).toBe(1000);

    const statuses = await db
      .select({ status: submissions.status })
      .from(submissions)
      .where(eq(submissions.campaignId, campaign.id));
    expect(statuses.filter((row) => row.status === "approved")).toHaveLength(1);
    expect(statuses.filter((row) => row.status === "pending")).toHaveLength(1);
  });

  it("charges the budget exactly once when the same submission is approved twice in parallel", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db, {
      payoutPer1kViewsCents: 500,
      totalBudgetCents: 10_000,
    });
    const submission = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    await insertMetric(db, { submissionId: submission.id, date: "2026-01-10", views: 2000 });

    const results = await Promise.allSettled([
      approveSubmission(db, submission.id),
      approveSubmission(db, submission.id),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    if (rejected[0]?.status === "rejected") {
      expect(rejected[0].reason).toBeInstanceOf(AlreadyReviewedError);
    }

    const [spentRow] = await db
      .select({ spent: campaigns.budgetSpentCents })
      .from(campaigns)
      .where(eq(campaigns.id, campaign.id));
    expect(spentRow?.spent).toBe(1000);
  });

  it("cannot approve a zero-earnings submission once the campaign completed", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db, {
      payoutPer1kViewsCents: 500,
      totalBudgetCents: 500,
    });
    const filling = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    // 1000 views earns exactly the 500-cent budget and completes the campaign.
    await insertMetric(db, { submissionId: filling.id, date: "2026-01-10", views: 1000 });
    await approveSubmission(db, filling.id);

    const late = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    await insertMetric(db, { submissionId: late.id, date: "2026-01-11", views: 500 });

    await expect(approveSubmission(db, late.id)).rejects.toBeInstanceOf(
      BudgetExceededError,
    );
  });

  it("rejects with a mandatory reason and refuses double review", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db);
    const submission = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });

    const rejected = await rejectSubmission(db, submission.id, "Off brief");
    expect(rejected.status).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Off brief");

    await expect(
      rejectSubmission(db, submission.id, "Again"),
    ).rejects.toBeInstanceOf(AlreadyReviewedError);
  });
});
