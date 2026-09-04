import { router } from "@/server/trpc/trpc";
import { campaignRouter } from "@/server/trpc/routers/campaign";
import { submissionRouter } from "@/server/trpc/routers/submission";
import { devRouter } from "@/server/trpc/routers/dev";

export const appRouter = router({
  campaign: campaignRouter,
  submission: submissionRouter,
  dev: devRouter,
});

export type AppRouter = typeof appRouter;
