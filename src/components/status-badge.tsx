"use client";

import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/i18n-provider";

const DOT_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  approved: "bg-emerald-600",
  rejected: "bg-red-600",
  paid: "bg-sky-600",
  draft: "bg-zinc-400",
  active: "bg-emerald-600",
  paused: "bg-amber-500",
  completed: "bg-zinc-500",
};

export function StatusBadge({
  kind,
  value,
}: {
  kind: "campaign" | "submission";
  value: string;
}) {
  const { t } = useI18n();
  const label =
    kind === "campaign"
      ? t(`statuses.campaign.${value}`)
      : t(`statuses.submission.${value}`);
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <span aria-hidden className={`size-1.5 rounded-full ${DOT_COLORS[value] ?? "bg-zinc-400"}`} />
      {label}
    </Badge>
  );
}
