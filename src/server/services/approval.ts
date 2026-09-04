import { and, desc, eq, ne, sql } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "@/server/db";
import {
  campaigns,
  submissionMetrics,
  submissions,
} from "@/server/db/schema";
import {
  AlreadyReviewedError,
  BudgetExceededError,
  DomainError,
} from "@/server/services/errors";
import { calculateEarningsCents } from "@/server/services/payout";

export interface ApprovalResult {
  payoutCents: number;
  budgetSpentCents: number;
  budgetLeftCents: number;
  campaignCompleted: boolean;
}

export async function latestMetricViews(
  db: NodePgDatabase<typeof schema>,
  submissionId: string,
): Promise<number | null> {
  const rows = await db
    .select({ views: submissionMetrics.views })
    .from(submissionMetrics)
    .where(eq(submissionMetrics.submissionId, submissionId))
    .orderBy(desc(submissionMetrics.capturedAt))
    .limit(1);
  return rows[0]?.views ?? null;
}

/**
 * Approve a pending submission inside one transaction.
 *
 * Two guards keep the money safe under concurrency, both as conditional
 * UPDATEs so Postgres row locks decide the winner:
 *  1. the submission must still be pending (no double approval of the same row),
 *  2. the campaign budget must still cover this payout (first come, first served).
 * When the spent counter reaches the total, the campaign flips to completed
 * in the same transaction. Any failed guard rolls the whole transaction back.
 */
export async function approveSubmission(
  db: NodePgDatabase<typeof schema>,
  submissionId: string,
): Promise<ApprovalResult> {
  return db.transaction(async (tx) => {
    const submissionRows = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);
    const submission = submissionRows[0];
    if (!submission) {
      throw new DomainError("SUBMISSION_NOT_FOUND", "Submission not found");
    }

    const campaignRows = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, submission.campaignId))
      .limit(1);
    const campaign = campaignRows[0];
    if (!campaign) {
      throw new DomainError("CAMPAIGN_NOT_FOUND", "Campaign not found");
    }

    const views = await latestMetricViews(tx, submissionId);
    const payoutCents = calculateEarningsCents(
      views ?? 0,
      campaign.payoutPer1kViewsCents,
    );

    const approvedRows = await tx
      .update(submissions)
      .set({ status: "approved", updatedAt: new Date() })
      .where(
        and(eq(submissions.id, submissionId), eq(submissions.status, "pending")),
      )
      .returning({ id: submissions.id });
    if (approvedRows.length === 0) {
      throw new AlreadyReviewedError();
    }

    const spentRows = await tx
      .update(campaigns)
      .set({
        budgetSpentCents: sql`${campaigns.budgetSpentCents} + ${payoutCents}`,
      })
      .where(
        and(
          eq(campaigns.id, campaign.id),
          ne(campaigns.status, "completed"),
          sql`${campaigns.budgetSpentCents} + ${payoutCents} <= ${campaigns.totalBudgetCents}`,
        ),
      )
      .returning({
        spent: campaigns.budgetSpentCents,
        total: campaigns.totalBudgetCents,
      });

    if (spentRows.length === 0) {
      const current = await tx
        .select({
          spent: campaigns.budgetSpentCents,
          total: campaigns.totalBudgetCents,
        })
        .from(campaigns)
        .where(eq(campaigns.id, campaign.id))
        .limit(1);
      const remaining = current[0] ? current[0].total - current[0].spent : 0;
      throw new BudgetExceededError(Math.max(0, remaining));
    }

    const { spent, total } = spentRows[0]!;
    const campaignCompleted = spent >= total;
    if (campaignCompleted) {
      await tx
        .update(campaigns)
        .set({ status: "completed" })
        .where(eq(campaigns.id, campaign.id));
    }

    return {
      payoutCents,
      budgetSpentCents: spent,
      budgetLeftCents: total - spent,
      campaignCompleted,
    };
  });
}

/**
 * Reject a pending submission with a mandatory reason. Conditional on pending
 * so a concurrently approved submission cannot be rejected afterwards.
 */
export async function rejectSubmission(
  db: NodePgDatabase<typeof schema>,
  submissionId: string,
  reason: string,
) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(submissions)
      .set({ status: "rejected", rejectionReason: reason, updatedAt: new Date() })
      .where(
        and(eq(submissions.id, submissionId), eq(submissions.status, "pending")),
      )
      .returning();
    if (rows.length === 0) {
      throw new AlreadyReviewedError();
    }
    return rows[0]!;
  });
}
