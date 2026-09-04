import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { adminProcedure, creatorProcedure, router, toTrpcError } from "@/server/trpc/trpc";
import { campaigns, submissionMetrics, submissions, users } from "@/server/db/schema";
import {
  paginationInputSchema,
  reviewQueueInputSchema,
  submissionCreateInputSchema,
  submissionIdInputSchema,
  submissionRejectInputSchema,
} from "@/lib/schemas/submission";
import { createSubmission } from "@/server/services/submission";
import { approveSubmission, rejectSubmission } from "@/server/services/approval";
import { calculateEarningsCents } from "@/server/services/payout";

type AnyDb = Parameters<typeof approveSubmission>[0];

async function latestMetricsBySubmission(
  db: AnyDb,
  submissionIds: string[],
): Promise<Map<string, { views: number; likes: number; comments: number }>> {
  const result = new Map();
  if (submissionIds.length === 0) {
    return result;
  }
  const rows = await db
    .select({
      submissionId: submissionMetrics.submissionId,
      capturedAt: submissionMetrics.capturedAt,
      views: submissionMetrics.views,
      likes: submissionMetrics.likes,
      comments: submissionMetrics.comments,
    })
    .from(submissionMetrics)
    .where(inArray(submissionMetrics.submissionId, submissionIds))
    .orderBy(asc(submissionMetrics.capturedAt));
  for (const row of rows) {
    result.set(row.submissionId, {
      views: row.views,
      likes: row.likes,
      comments: row.comments,
    });
  }
  return result;
}

export const submissionRouter = router({
  // Creator submits a clip URL to an active campaign whose platforms match.
  create: creatorProcedure
    .input(submissionCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const submission = await createSubmission(ctx.db, {
          creatorId: ctx.user.id,
          campaignId: input.campaignId,
          postUrl: input.postUrl,
        });
        return submission;
      } catch (err) {
        throw toTrpcError(err);
      }
    }),

  myList: creatorProcedure
    .input(paginationInputSchema)
    .query(async ({ ctx, input }) => {
      const where = eq(submissions.creatorId, ctx.user.id);
      const totalRows = await ctx.db
        .select({ value: count() })
        .from(submissions)
        .where(where);
      const total = totalRows[0]?.value ?? 0;

      const rows = await ctx.db
        .select({
          id: submissions.id,
          campaignId: submissions.campaignId,
          campaignTitle: campaigns.title,
          campaignPayoutPer1kViewsCents: campaigns.payoutPer1kViewsCents,
          campaignStatus: campaigns.status,
          postUrl: submissions.postUrl,
          platform: submissions.platform,
          status: submissions.status,
          rejectionReason: submissions.rejectionReason,
          createdAt: submissions.createdAt,
          updatedAt: submissions.updatedAt,
        })
        .from(submissions)
        .innerJoin(campaigns, eq(submissions.campaignId, campaigns.id))
        .where(where)
        .orderBy(desc(submissions.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      const metrics = await latestMetricsBySubmission(
        ctx.db,
        rows.map((row) => row.id),
      );
      const items = rows.map((row) => {
        const latest = metrics.get(row.id);
        const isPaidWork = row.status === "approved" || row.status === "paid";
        return {
          id: row.id,
          campaignId: row.campaignId,
          campaignTitle: row.campaignTitle,
          postUrl: row.postUrl,
          platform: row.platform,
          status: row.status,
          rejectionReason: row.rejectionReason,
          createdAt: row.createdAt,
          views: latest?.views ?? null,
          estimatedEarningsCents:
            isPaidWork && latest
              ? calculateEarningsCents(
                  latest.views,
                  row.campaignPayoutPer1kViewsCents,
                )
              : null,
        };
      });

      return { items, total, page: input.page, pageSize: input.pageSize };
    }),

  // Admin: pending submissions of one campaign, oldest first, with the cost
  // approving each one would add, so the queue row tells the money story.
  reviewQueue: adminProcedure
    .input(reviewQueueInputSchema)
    .query(async ({ ctx, input }) => {
      const campaignRows = await ctx.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.campaignId))
        .limit(1);
      const campaign = campaignRows[0];
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      const where = and(
        eq(submissions.campaignId, input.campaignId),
        eq(submissions.status, "pending"),
      );
      const totalRows = await ctx.db
        .select({ value: count() })
        .from(submissions)
        .where(where);
      const total = totalRows[0]?.value ?? 0;

      const rows = await ctx.db
        .select({
          id: submissions.id,
          creatorEmail: users.email,
          postUrl: submissions.postUrl,
          platform: submissions.platform,
          status: submissions.status,
          createdAt: submissions.createdAt,
        })
        .from(submissions)
        .innerJoin(users, eq(submissions.creatorId, users.id))
        .where(where)
        .orderBy(asc(submissions.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      const metrics = await latestMetricsBySubmission(
        ctx.db,
        rows.map((row) => row.id),
      );
      const items = rows.map((row) => {
        const latest = metrics.get(row.id);
        const views = latest?.views ?? null;
        return {
          id: row.id,
          creatorEmail: row.creatorEmail,
          postUrl: row.postUrl,
          platform: row.platform,
          createdAt: row.createdAt,
          views,
          estimatedCostCents: calculateEarningsCents(
            views ?? 0,
            campaign.payoutPer1kViewsCents,
          ),
        };
      });

      return {
        campaign: {
          id: campaign.id,
          title: campaign.title,
          payoutPer1kViewsCents: campaign.payoutPer1kViewsCents,
          budgetSpentCents: campaign.budgetSpentCents,
          budgetLeftCents: Math.max(
            0,
            campaign.totalBudgetCents - campaign.budgetSpentCents,
          ),
        },
        items,
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  approve: adminProcedure
    .input(submissionIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await approveSubmission(ctx.db, input.id);
      } catch (err) {
        throw toTrpcError(err);
      }
    }),

  reject: adminProcedure
    .input(submissionRejectInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const submission = await rejectSubmission(ctx.db, input.id, input.reason);
        return { id: submission.id, status: submission.status };
      } catch (err) {
        throw toTrpcError(err);
      }
    }),
});
