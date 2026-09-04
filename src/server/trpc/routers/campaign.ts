import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, sum } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, creatorProcedure, router } from "@/server/trpc/trpc";
import {
  campaigns,
  submissionMetrics,
  submissions,
  type Campaign,
} from "@/server/db/schema";
import {
  campaignCreateSchema,
  campaignIdInputSchema,
  campaignListInputSchema,
  campaignUpdateSchema,
} from "@/lib/schemas/campaign";
import { enumerateDays, toDateOnly } from "@/lib/dates";
import { latestMetricViews } from "@/server/services/approval";

function mapIsoToDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined;
}

function campaignToDto(campaign: Campaign, viewerRole: "admin" | "creator") {
  if (viewerRole === "admin") {
    return {
      id: campaign.id,
      title: campaign.title,
      platforms: campaign.platforms,
      payoutPer1kViewsCents: campaign.payoutPer1kViewsCents,
      totalBudgetCents: campaign.totalBudgetCents,
      budgetSpentCents: campaign.budgetSpentCents,
      budgetLeftCents: Math.max(
        0,
        campaign.totalBudgetCents - campaign.budgetSpentCents,
      ),
      status: campaign.status,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      createdAt: campaign.createdAt,
    };
  }
  return {
    id: campaign.id,
    title: campaign.title,
    platforms: campaign.platforms,
    payoutPer1kViewsCents: campaign.payoutPer1kViewsCents,
    status: campaign.status,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    createdAt: campaign.createdAt,
  };
}

export const campaignRouter = router({
  // Admin: paginated list with title search and status filter, server-side.
  list: adminProcedure
    .input(campaignListInputSchema)
    .query(async ({ ctx, input }) => {
      const conditions = [];
      if (input.search) {
        conditions.push(ilike(campaigns.title, `%${input.search}%`));
      }
      if (input.status) {
        conditions.push(eq(campaigns.status, input.status));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const totalRows = await ctx.db
        .select({ value: count() })
        .from(campaigns)
        .where(where);
      const total = totalRows[0]?.value ?? 0;

      const rows = await ctx.db
        .select()
        .from(campaigns)
        .where(where)
        .orderBy(desc(campaigns.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);

      return {
        items: rows.map((campaign) => campaignToDto(campaign, "admin")),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // Creator: campaigns currently accepting submissions.
  listActive: creatorProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const rows = await ctx.db
      .select()
      .from(campaigns)
      .where(
        and(
          eq(campaigns.status, "active"),
          lte(campaigns.startsAt, now),
          gte(campaigns.endsAt, now),
        ),
      )
      .orderBy(asc(campaigns.endsAt));
    return rows.map((campaign) => campaignToDto(campaign, "creator"));
  }),

  getById: creatorProcedure
    .input(campaignIdInputSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);
      const campaign = rows[0];
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      const now = new Date();
      const isOpen =
        campaign.status === "active" &&
        now >= campaign.startsAt &&
        now <= campaign.endsAt;
      if (ctx.user.role === "creator" && !isOpen) {
        // Creators must not learn about draft, paused or completed campaigns
        // by guessing ids.
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      return campaignToDto(campaign, ctx.user.role);
    }),

  create: adminProcedure
    .input(campaignCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const inserted = await ctx.db
        .insert(campaigns)
        .values({
          title: input.title,
          platforms: input.platforms,
          payoutPer1kViewsCents: input.payoutPer1kViewsCents,
          totalBudgetCents: input.totalBudgetCents,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
        })
        .returning();
      return campaignToDto(inserted[0]!, "admin");
    }),

  update: adminProcedure
    .input(z.object({ id: z.string().uuid(), data: campaignUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);
      if (existing.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }
      const data = input.data;
      const updated = await ctx.db
        .update(campaigns)
        .set({
          title: data.title,
          platforms: data.platforms,
          payoutPer1kViewsCents: data.payoutPer1kViewsCents,
          totalBudgetCents: data.totalBudgetCents,
          startsAt: mapIsoToDate(data.startsAt),
          endsAt: mapIsoToDate(data.endsAt),
          status: data.status,
        })
        .where(eq(campaigns.id, input.id))
        .returning();
      return campaignToDto(updated[0]!, "admin");
    }),

  // Admin overview: approved views, budget position and a zero-filled daily
  // views series across the whole campaign period (days without metrics = 0).
  overview: adminProcedure
    .input(campaignIdInputSchema)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, input.id))
        .limit(1);
      const campaign = rows[0];
      if (!campaign) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });
      }

      const approvedRows = await ctx.db
        .select({ id: submissions.id })
        .from(submissions)
        .where(
          and(
            eq(submissions.campaignId, input.id),
            inArray(submissions.status, ["approved", "paid"]),
          ),
        );
      const approvedSubmissionIds = approvedRows.map((row) => row.id);

      let approvedViews = 0;
      if (approvedSubmissionIds.length > 0) {
        const latestRows = await Promise.all(
          approvedSubmissionIds.map((id) => latestMetricViews(ctx.db, id)),
        );
        approvedViews = latestRows.reduce<number>(
          (total, views) => total + (views ?? 0),
          0,
        );
      }

      const startDate = toDateOnly(campaign.startsAt);
      const endDate = toDateOnly(campaign.endsAt);
      const dailyRows =
        approvedSubmissionIds.length > 0
          ? await ctx.db
              .select({
                capturedAt: submissionMetrics.capturedAt,
                views: sum(submissionMetrics.views),
              })
              .from(submissionMetrics)
              .innerJoin(
                submissions,
                eq(submissionMetrics.submissionId, submissions.id),
              )
              .where(
                and(
                  inArray(submissions.id, approvedSubmissionIds),
                  gte(submissionMetrics.capturedAt, startDate),
                  lte(submissionMetrics.capturedAt, endDate),
                ),
              )
              .groupBy(submissionMetrics.capturedAt)
              .orderBy(asc(submissionMetrics.capturedAt))
          : [];
      const viewsByDay = new Map<string, number>();
      for (const row of dailyRows) {
        viewsByDay.set(row.capturedAt, Number(row.views ?? 0));
      }
      const series = enumerateDays(startDate, endDate).map((date) => ({
        date,
        views: viewsByDay.get(date) ?? 0,
      }));

      return {
        approvedViews,
        totalBudgetCents: campaign.totalBudgetCents,
        budgetSpentCents: campaign.budgetSpentCents,
        budgetLeftCents: Math.max(
          0,
          campaign.totalBudgetCents - campaign.budgetSpentCents,
        ),
        series,
      };
    }),
});
