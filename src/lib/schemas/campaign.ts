import { z } from "zod";
import { PLATFORM_VALUES } from "@/lib/platforms";
import { campaignStatusEnum } from "@/server/db/schema";

const platformSchema = z.enum(PLATFORM_VALUES);
const isoDateTime = z
  .string()
  .datetime({ message: "Use a valid ISO date-time" });

const campaignFields = {
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  platforms: z.array(platformSchema).min(1, "Pick at least one platform"),
  payoutPer1kViewsCents: z.number().int().positive("Payout must be positive"),
  totalBudgetCents: z.number().int().positive("Budget must be positive"),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
};

export const campaignCreateSchema = z
  .object(campaignFields)
  .refine((campaign) => new Date(campaign.endsAt) > new Date(campaign.startsAt), {
    message: "End date must be after start date",
    path: ["endsAt"],
  });

export const campaignUpdateSchema = z
  .object(campaignFields)
  .partial()
  .extend({
    status: z.enum(["draft", "active", "paused"]).optional(),
  })
  .refine(
    (campaign) =>
      campaign.startsAt === undefined ||
      campaign.endsAt === undefined ||
      new Date(campaign.endsAt) > new Date(campaign.startsAt),
    { message: "End date must be after start date", path: ["endsAt"] },
  );

export const campaignListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(120).optional(),
  status: z.enum(campaignStatusEnum.enumValues).optional(),
});

export const campaignIdInputSchema = z.object({
  id: z.string().uuid(),
});

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;
export type CampaignListInput = z.infer<typeof campaignListInputSchema>;
