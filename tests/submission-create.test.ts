import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appRouter } from "../src/server/trpc/routers/_app";
import { createCampaign, createUser, resetDb, testDb } from "./helpers/db";
import type { TestDb } from "./helpers/db";
import type { User } from "../src/server/db/schema";

const TIKTOK_URL = "https://www.tiktok.com/@maker/video/7123456789012345678";
const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const INSTAGRAM_URL = "https://www.instagram.com/reel/CxYzAbCdEfG/";

async function submitAsCreator(
  db: TestDb,
  creator: User,
  campaignId: string,
  postUrl: string,
) {
  return appRouter.createCaller({ db, user: creator, setCookie: () => {} }).submission.create({
    campaignId,
    postUrl,
  });
}

async function expectErrorCode(promise: Promise<unknown>, code: TRPCError["code"]) {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe(code);
    return err as TRPCError;
  }
  throw new Error("Expected the call to throw");
}

describe("submission.create", () => {
  beforeEach(async () => {
    await resetDb(testDb());
  });

  afterEach(async () => {
    await resetDb(testDb());
  });

  it("accepts a matching post URL on an active campaign", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db, { platforms: ["tiktok"] });

    const submission = await submitAsCreator(db, creator, campaign.id, TIKTOK_URL);

    expect(submission.status).toBe("pending");
    expect(submission.platform).toBe("tiktok");
    expect(submission.creatorId).toBe(creator.id);
  });

  it("rejects URLs that do not look like a real post", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db);

    const err = await expectErrorCode(
      submitAsCreator(db, creator, campaign.id, "https://example.com/not-a-post"),
      "BAD_REQUEST",
    );
    expect((err.cause as { reason?: string }).reason).toBe("INVALID_POST_URL");
  });

  it("rejects a post whose platform the campaign does not accept", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db, { platforms: ["tiktok"] });

    const err = await expectErrorCode(
      submitAsCreator(db, creator, campaign.id, YOUTUBE_URL),
      "BAD_REQUEST",
    );
    expect((err.cause as { reason?: string }).reason).toBe("PLATFORM_MISMATCH");
  });

  it("accepts each platform variant the campaign allows", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db, {
      platforms: ["instagram", "youtube"],
    });

    await expect(
      submitAsCreator(db, creator, campaign.id, INSTAGRAM_URL),
    ).resolves.toMatchObject({ platform: "instagram" });
    await expect(
      submitAsCreator(db, creator, campaign.id, YOUTUBE_URL),
    ).resolves.toMatchObject({ platform: "youtube" });
  });

  it("blocks the same URL from entering the same campaign twice", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const campaign = await createCampaign(db, { platforms: ["tiktok"] });

    await submitAsCreator(db, creator, campaign.id, TIKTOK_URL);

    const err = await expectErrorCode(
      submitAsCreator(db, creator, campaign.id, TIKTOK_URL),
      "CONFLICT",
    );
    expect((err.cause as { reason?: string }).reason).toBe("DUPLICATE_URL");
  });

  it("does not accept submissions for campaigns that are not open", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const completed = await createCampaign(db, {
      platforms: ["tiktok"],
      status: "completed",
    });
    const draft = await createCampaign(db, {
      platforms: ["tiktok"],
      status: "draft",
    });
    const paused = await createCampaign(db, {
      platforms: ["tiktok"],
      status: "paused",
    });

    for (const campaign of [completed, draft, paused]) {
      const err = await expectErrorCode(
        submitAsCreator(db, creator, campaign.id, TIKTOK_URL),
        "PRECONDITION_FAILED",
      );
      expect((err.cause as { reason?: string }).reason).toBe("CAMPAIGN_NOT_ACCEPTING");
    }
  });

  it("treats unknown campaign ids as not found", async () => {
    const db = testDb();
    const creator = await createUser(db);
    const missingId = "00000000-0000-4000-8000-000000000000";
    await expectErrorCode(
      submitAsCreator(db, creator, missingId, TIKTOK_URL),
      "NOT_FOUND",
    );
  });
});
