"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RoleGuard } from "@/components/role-guard";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert, NoticeAlert } from "@/components/page-alert";
import { DailyViewsChart } from "@/components/daily-views-chart";
import { useI18n } from "@/components/i18n-provider";
import { useLocalizedError } from "@/components/use-error-message";
import { getErrorCause } from "@/lib/trpc/error";
import { trpc } from "@/lib/trpc/client";

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGuard role="admin">
      <CampaignDetail campaignId={id} />
    </RoleGuard>
  );
}

function CampaignDetail({ campaignId }: { campaignId: string }) {
  const { t, fmtMoney, fmtDate, fmtNumber } = useI18n();
  const localizedError = useLocalizedError();
  const utils = trpc.useUtils();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const detail = trpc.campaign.getById.useQuery({ id: campaignId });
  const overview = trpc.campaign.overview.useQuery({ id: campaignId });
  const queue = trpc.submission.reviewQueue.useQuery({
    campaignId,
    page: 1,
    pageSize: 50,
  });

  const invalidateAll = () => {
    utils.campaign.overview.invalidate({ id: campaignId });
    utils.campaign.getById.invalidate({ id: campaignId });
    utils.submission.reviewQueue.invalidate({ campaignId });
  };

  const approve = trpc.submission.approve.useMutation({
    onSuccess: (result) => {
      const paid = fmtMoney(result.payoutCents);
      const left = fmtMoney(result.budgetLeftCents);
      setAnnouncement(
        result.campaignCompleted
          ? t("admin.approveCompleted")
          : t("admin.approveSuccess", { amount: paid, left }),
      );
      invalidateAll();
    },
    onError: (err) => {
      const cause = getErrorCause(err);
      if (cause?.reason === "BUDGET_EXCEEDED") {
        const row = queue.data?.items.find((item) => item.id === (approve.variables?.id ?? ""));
        setAnnouncement(
          t("admin.approveOverBudget", {
            amount: row ? fmtMoney(row.estimatedCostCents) : fmtMoney(cause.remainingCents ?? 0),
            left: fmtMoney(cause.remainingCents ?? 0),
          }),
        );
      } else if (cause?.reason === "ALREADY_REVIEWED") {
        setAnnouncement(t("admin.alreadyReviewed"));
      } else {
        setAnnouncement(localizedError(err));
      }
      invalidateAll();
    },
  });

  const reject = trpc.submission.reject.useMutation({
    onSuccess: () => {
      setAnnouncement(t("admin.rejectDone"));
      setRejectingId(null);
      setReason("");
      invalidateAll();
    },
    onError: (err) => {
      setAnnouncement(localizedError(err));
      setRejectingId(null);
    },
  });

  if (detail.isError || overview.isError) {
    return (
      <ErrorAlert
        title={t("errors.CAMPAIGN_NOT_FOUND")}
        onRetry={() => {
          detail.refetch();
          overview.refetch();
        }}
      />
    );
  }

  if (detail.isLoading || overview.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const campaign = detail.data!;
  const data = overview.data!;
  const budgetUsedPercent =
    campaign.totalBudgetCents > 0
      ? Math.min(100, Math.round((campaign.budgetSpentCents / campaign.totalBudgetCents) * 100))
      : 0;
  const completed = campaign.status === "completed";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/admin/campaigns" className="text-sm text-muted-foreground hover:underline">
            ← {t("nav.campaigns")}
          </Link>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {campaign.title}
            <StatusBadge kind="campaign" value={campaign.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("common.perThousand", { amount: fmtMoney(campaign.payoutPer1kViewsCents) })}
            <span aria-hidden> · </span>
            {campaign.platforms.map((platform) => t(`platforms.${platform}`)).join(", ")}
            <span aria-hidden> · </span>
            {fmtDate(campaign.startsAt)} - {fmtDate(campaign.endsAt)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/campaigns/${campaign.id}/edit`}>
            <Pencil className="size-3.5" aria-hidden />
            {t("admin.editTitle")}
          </Link>
        </Button>
      </div>

      {campaign.status === "draft" ? <NoticeAlert title={t("admin.draftNotice")} /> : null}
      {campaign.status === "paused" ? <NoticeAlert title={t("admin.pausedNotice")} /> : null}
      {completed ? (
        <NoticeAlert title={t("admin.completedNotice", { amount: fmtMoney(data.budgetLeftCents) })} />
      ) : null}

      <section aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="mb-3 text-sm font-medium text-muted-foreground">
          {t("admin.overviewTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewCard label={t("admin.labelBudget")} value={fmtMoney(data.totalBudgetCents)} />
          <OverviewCard label={t("admin.labelSpent")} value={fmtMoney(data.budgetSpentCents)} />
          <OverviewCard
            label={t("admin.labelLeft")}
            value={completed ? t("common.notApplicable") : fmtMoney(data.budgetLeftCents)}
          />
          <OverviewCard label={t("admin.labelApprovedViews")} value={fmtNumber(data.approvedViews)} />
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{t("admin.labelBudgetProgress")}</span>
            <span className="tabular-nums">
              {t("admin.budgetProgressLabel", {
                amount: fmtMoney(data.budgetSpentCents),
                total: fmtMoney(data.totalBudgetCents),
              })}
            </span>
          </div>
          <Progress value={budgetUsedPercent} aria-label={t("admin.labelBudgetProgress")} />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.chartTitle")}</CardTitle>
          <CardDescription>{t("admin.chartCaption")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DailyViewsChart series={data.series} caption={t("admin.chartTitle")} />
        </CardContent>
      </Card>

      <section aria-labelledby="queue-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="queue-heading" className="text-lg font-semibold tracking-tight">
              {t("admin.queueTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("admin.queueDescription")}</p>
          </div>
          {queue.data ? (
            <span className="text-xs text-muted-foreground">
              {t("admin.labelLeft")}:{" "}
              <span className="tabular-nums font-medium text-foreground">
                {fmtMoney(queue.data.campaign.budgetLeftCents)}
              </span>
            </span>
          ) : null}
        </div>

        {queue.isError ? (
          <ErrorAlert title={t("errors.INTERNAL_SERVER_ERROR")} onRetry={() => queue.refetch()} />
        ) : null}

        {queue.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : queue.data && queue.data.items.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.tableCreator")}</TableHead>
                  <TableHead>{t("admin.tableClip")}</TableHead>
                  <TableHead className="text-right">{t("admin.tableViews")}</TableHead>
                  <TableHead className="text-right">{t("admin.tableCost")}</TableHead>
                  <TableHead className="text-right">{t("admin.tableActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap text-sm">{item.creatorEmail}</TableCell>
                    <TableCell className="max-w-[16rem]">
                      <a
                        href={item.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm underline-offset-4 hover:underline"
                      >
                        {item.postUrl}
                      </a>
                      <Badge variant="outline" className="mt-1 font-normal text-xs">
                        {t(`platforms.${item.platform}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {item.views === null ? t("common.notApplicable") : fmtNumber(item.views)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {fmtMoney(item.estimatedCostCents)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={completed || approve.isPending}
                          onClick={() => approve.mutate({ id: item.id })}
                        >
                          {t("admin.approve")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reject.isPending}
                          onClick={() => {
                            setReason("");
                            setRejectingId(item.id);
                          }}
                        >
                          {t("admin.reject")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState title={t("admin.queueEmpty")} />
        )}
      </section>

      <RejectDialog
        open={rejectingId !== null}
        title={t("admin.rejectDialogTitle")}
        description={t("admin.rejectDialogDescription")}
        reason={reason}
        onReasonChange={setReason}
        onCancel={() => setRejectingId(null)}
        onConfirm={() => {
          if (rejectingId && reason.trim()) {
            reject.mutate({ id: rejectingId, reason: reason.trim() });
          }
        }}
        busy={reject.isPending}
      />

      {/* Live region: every review outcome is announced for screen readers. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement ?? ""}
      </p>
    </div>
  );
}

function OverviewCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function RejectDialog({
  open,
  title,
  description,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  description: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-reason">{t("admin.rejectReasonLabel")}</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder={t("admin.rejectReasonPlaceholder")}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="destructive" disabled={busy || reason.trim().length === 0} onClick={onConfirm}>
            {t("admin.reject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
