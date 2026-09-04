import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../src/server/trpc/routers/_app";
import { createCampaign, createSubmission, createUser, insertMetric, resetDb, testDb } from "./helpers/db";
import type { TestDb } from "./helpers/db";
import type { User } from "../src/server/db/schema";

function callerFor(db: TestDb, user: User) {
  return appRouter.createCaller({
    db,
    user,
    setCookie: () => {
      throw new Error("setCookie is not expected in direct caller tests");
    },
  });
}

async function expectErrorCode(promise: Promise<unknown>, code: TRPCError["code"]) {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(TRPCError);
    const trpcError = err as TRPCError;
    expect(trpcError.code).toBe(code);
    return trpcError;
  }
  throw new Error("Expected the call to throw");
}

describe("access control", () => {
  beforeEach(async () => {
    await resetDb(testDb());
  });

  afterEach(async () => {
    await resetDb(testDb());
  });

  it("keeps admin-only procedures away from creators", async () => {
    const db = testDb();
    const creator = await createUser(db, { role: "creator" });
    const caller = callerFor(db, creator);

    await expectErrorCode(caller.campaign.list({ page: 1, pageSize: 10 }), "FORBIDDEN");
    await expectErrorCode(
      caller.campaign.create({
        title: "Nope",
        platforms: ["tiktok"],
        payoutPer1kViewsCents: 500,
        totalBudgetCents: 1000,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
      "FORBIDDEN",
    );
  });

  it("keeps creator-only procedures away from admins", async () => {
    const db = testDb();
    const admin = await createUser(db, { role: "admin" });
    const campaign = await createCampaign(db);
    const caller = callerFor(db, admin);

    await expectErrorCode(
      caller.submission.create({ campaignId: campaign.id, postUrl: "https://www.tiktok.com/@x/video/1" }),
      "FORBIDDEN",
    );
    await expectErrorCode(caller.campaign.listActive(), "FORBIDDEN");
  });

  it("lets an admin approve a pending submission of any creator", async () => {
    const db = testDb();
    const admin = await createUser(db, { role: "admin" });
    const creator = await createUser(db);
    const campaign = await createCampaign(db, { totalBudgetCents: 10_000 });
    const submission = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creator.id,
    });
    await insertMetric(db, { submissionId: submission.id, date: "2026-01-10", views: 2000 });

    const result = await callerFor(db, admin).submission.approve({ id: submission.id });
    expect(result.payoutCents).toBe(1000);
  });

  it("shows a creator only their own submissions", async () => {
    const db = testDb();
    const creatorA = await createUser(db);
    const creatorB = await createUser(db);
    const campaign = await createCampaign(db);
    const ownSubmission = await createSubmission(db, {
      campaignId: campaign.id,
      creatorId: creatorA.id,
    });
    await createSubmission(db, { campaignId: campaign.id, creatorId: creatorB.id });

    const result = await callerFor(db, creatorA).submission.myList({ page: 1, pageSize: 10 });

    expect(result.total).toBe(1);
    expect(result.items[0]?.id).toBe(ownSubmission.id);
  });

  it("returns NOT_FOUND for submissions that do not exist", async () => {
    const db = testDb();
    const admin = await createUser(db, { role: "admin" });
    const missingId = "00000000-0000-4000-8000-000000000000";
    await expectErrorCode(
      callerFor(db, admin).submission.approve({ id: missingId }),
      "NOT_FOUND",
    );
  });

  it("switches demo users by writing a session cookie only for real users", async () => {
    const db = testDb();
    const alice = await createUser(db, { email: "alice@example.test" });
    const cookies: string[] = [];
    const caller = appRouter.createCaller({
      db,
      user: null,
      setCookie: (cookie) => cookies.push(cookie),
    });

    expect(await caller.dev.whoami()).toBeNull();

    const result = await caller.dev.switchUser({ userId: alice.id });
    expect(result.ok).toBe(true);
    expect(cookies[0]).toContain("demo_session=");

    const missingId = "00000000-0000-4000-8000-000000000000";
    await expectErrorCode(caller.dev.switchUser({ userId: missingId }), "NOT_FOUND");
  });
});
