import { pgTable, uuid, text, integer, timestamp, date, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "creator"]);
export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "active", "paused", "completed"]);
export const submissionStatusEnum = pgEnum("submission_status", ["pending", "approved", "rejected", "paid"]);
export const platformEnum = pgEnum("platform", ["tiktok", "instagram", "youtube"]);

export const users = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  role: roleEnum("role").notNull().default("creator"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const campaigns = pgTable("campaign", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  platforms: platformEnum("platforms").array().notNull(),
  payoutPer1kViewsCents: integer("payout_per_1k_views_cents").notNull(),
  totalBudgetCents: integer("total_budget_cents").notNull(),
  // Denormalized counter kept on the campaign row so approvals can spend the
  // budget with one atomic conditional UPDATE instead of a SUM over rows,
  // which would race under concurrent approvals.
  budgetSpentCents: integer("budget_spent_cents").notNull().default(0),
  status: campaignStatusEnum("status").notNull().default("draft"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const submissions = pgTable(
  "submission",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id),
    postUrl: text("post_url").notNull(),
    platform: platformEnum("platform").notNull(),
    status: submissionStatusEnum("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The same clip URL can never enter the same campaign twice, enforced by
    // the database, not only by application checks.
    uniqueIndex("submission_campaign_url_uq").on(t.campaignId, t.postUrl),
  ],
);

export const submissionMetrics = pgTable(
  "submission_metric",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id),
    capturedAt: date("captured_at").notNull(),
    views: integer("views").notNull(),
    likes: integer("likes").notNull(),
    comments: integer("comments").notNull(),
  },
  (t) => [
    // One row per submission per day; the backbone of ingest idempotency.
    uniqueIndex("submission_metric_day_uq").on(t.submissionId, t.capturedAt),
  ],
);

export type User = typeof users.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type SubmissionMetric = typeof submissionMetrics.$inferSelect;

export type Role = User["role"];
export type CampaignStatus = Campaign["status"];
export type SubmissionStatus = Submission["status"];
export type Platform = Submission["platform"];
