"use client";

import { RoleGuard } from "@/components/role-guard";
import { CampaignForm } from "@/components/campaign-form";
import { useI18n } from "@/components/i18n-provider";

export default function NewCampaignPage() {
  return (
    <RoleGuard role="admin">
      <NewCampaignContent />
    </RoleGuard>
  );
}

function NewCampaignContent() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("admin.createTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.createDescription")}</p>
      </div>
      <CampaignForm />
    </div>
  );
}
