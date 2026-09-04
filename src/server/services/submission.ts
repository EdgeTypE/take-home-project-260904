import { and, eq } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { schema } from "@/server/db";
import { campaigns, submissions } from "@/server/db/schema";
import { DomainError } from "@/server/services/errors";
import { platformFromUrl } from "@/lib/platforms";

export interface CreateSubmissionInput {
  creatorId: string;
  campaignId: string;
  postUrl: string;
}

export async function createSubmission(
  db: NodePgDatabase<typeof schema>,
  input: CreateSubmissionInput,
) {
  const campaignRows = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, input.campaignId))
    .limit(1);
  const campaign = campaignRows[0];
  if (!campaign) {
    throw new DomainError("CAMPAIGN_NOT_FOUND", "Campaign not found");
  }

  const now = new Date();
  const isOpen =
    campaign.status === "active" &&
    now >= campaign.startsAt &&
    now <= campaign.endsAt;
  if (!isOpen) {
    throw new DomainError(
      "CAMPAIGN_NOT_ACCEPTING",
      "This campaign is not accepting submissions right now",
    );
  }

  const platform = platformFromUrl(input.postUrl);
  if (!platform) {
    throw new DomainError(
      "INVALID_POST_URL",
      "That URL does not look like a TikTok, Instagram or YouTube post",
    );
  }
  if (!campaign.platforms.includes(platform)) {
    throw new DomainError(
      "PLATFORM_MISMATCH",
      `This campaign only accepts ${campaign.platforms.join(", ")} posts`,
    );
  }

  const duplicateRows = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.campaignId, input.campaignId),
        eq(submissions.postUrl, input.postUrl),
      ),
    )
    .limit(1);
  if (duplicateRows.length > 0) {
    throw new DomainError(
      "DUPLICATE_URL",
      "This URL was already submitted to this campaign",
    );
  }

  try {
    const inserted = await db
      .insert(submissions)
      .values({
        campaignId: input.campaignId,
        creatorId: input.creatorId,
        postUrl: input.postUrl,
        platform,
      })
      .returning();
    return inserted[0]!;
  } catch (err) {
    // The unique index is the final word even if two requests race the precheck.
    if ((err as { code?: string }).code === "23505") {
      throw new DomainError(
        "DUPLICATE_URL",
        "This URL was already submitted to this campaign",
      );
    }
    throw err;
  }
}
