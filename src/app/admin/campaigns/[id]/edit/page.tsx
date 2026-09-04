"use client";

import { use } from "react";
import { RoleGuard } from "@/components/role-guard";
import { CampaignForm } from "@/components/campaign-form";
import { useI18n } from "@/components/i18n-provider";

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGuard role="admin">
      <EditCampaignContent campaignId={id} />
    </RoleGuard>
  );
}

function EditCampaignContent({ campaignId }: { campaignId: string }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.editTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.campaignsDescription")}</p>
      </div>
      <CampaignForm campaignId={campaignId} />
    </div>
  );
}
