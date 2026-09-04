"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleGuard } from "@/components/role-guard";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/page-alert";
import { useI18n } from "@/components/i18n-provider";
import { trpc } from "@/lib/trpc/client";

export default function CreatorCampaignsPage() {
  return (
    <RoleGuard role="creator">
      <ActiveCampaigns />
    </RoleGuard>
  );
}

function ActiveCampaigns() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const campaigns = trpc.campaign.listActive.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("creator.campaignsTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("creator.campaignsDescription")}</p>
      </div>

      {campaigns.isError ? (
        <ErrorAlert title={t("errors.INTERNAL_SERVER_ERROR")} onRetry={() => campaigns.refetch()} />
      ) : null}

      {campaigns.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : campaigns.data && campaigns.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {campaigns.data.map((campaign) => (
            <Card key={campaign.id} className="flex flex-col">
              <CardHeader>
                <CardTitle>{campaign.title}</CardTitle>
                <CardDescription className="flex flex-wrap gap-1.5">
                  {campaign.platforms.map((platform) => (
                    <Badge key={platform} variant="outline" className="font-normal text-xs">
                      {t(`platforms.${platform}`)}
                    </Badge>
                  ))}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto flex items-end justify-between gap-4">
                <div className="space-y-1 text-sm">
                  <p className="font-medium tabular-nums">
                    {t("common.perThousand", { amount: fmtMoney(campaign.payoutPer1kViewsCents) })}
                  </p>
                  <p className="text-muted-foreground">
                    {t("creator.campaignEnds", { date: fmtDate(campaign.endsAt) })}
                  </p>
                </div>
                <Button asChild>
                  <Link href={`/creator/campaigns/${campaign.id}`}>{t("creator.submitButton")}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={t("creator.emptyActive")} />
      )}
    </div>
  );
}
