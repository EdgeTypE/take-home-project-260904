import { z } from "zod";

export const paginationInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export const submissionCreateInputSchema = z.object({
  campaignId: z.string().uuid(),
  // Full URL validation happens against the platform patterns on the server;
  // here we only require a plausible absolute http(s) URL.
  postUrl: z
    .string()
    .trim()
    .url("Enter a full post URL")
    .max(2048),
});

export const submissionIdInputSchema = z.object({
  id: z.string().uuid(),
});

export const submissionRejectInputSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1, "A rejection reason is required").max(500),
});

export const reviewQueueInputSchema = z.object({
  campaignId: z.string().uuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(10),
});

export type SubmissionCreateInput = z.infer<typeof submissionCreateInputSchema>;
