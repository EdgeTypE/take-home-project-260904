"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleGuard } from "@/components/role-guard";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/page-alert";
import { useI18n } from "@/components/i18n-provider";
import { trpc } from "@/lib/trpc/client";

export default function MySubmissionsPage() {
  return (
    <RoleGuard role="creator">
      <MySubmissions />
    </RoleGuard>
  );
}

function MySubmissions() {
  const { t, fmtMoney, fmtNumber, fmtDate } = useI18n();
  const mine = trpc.submission.myList.useQuery({ page: 1, pageSize: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("creator.mySubmissionsTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("creator.mySubmissionsDescription")}</p>
      </div>

      {mine.isError ? (
        <ErrorAlert title={t("errors.INTERNAL_SERVER_ERROR")} onRetry={() => mine.refetch()} />
      ) : null}

      {mine.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : mine.data && mine.data.items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("creator.campaignColumn")}</TableHead>
                <TableHead>{t("creator.clipColumn")}</TableHead>
                <TableHead>{t("creator.statusColumn")}</TableHead>
                <TableHead className="text-right">{t("creator.viewsColumn")}</TableHead>
                <TableHead className="text-right">{t("creator.earningsColumn")}</TableHead>
                <TableHead>{t("creator.submittedColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mine.data.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[12rem]">
                    <Link
                      href={`/creator/campaigns/${row.campaignId}`}
                      className="text-sm underline-offset-4 hover:underline"
                    >
                      {row.campaignTitle}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[16rem]">
                    <a
                      href={row.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm underline-offset-4 hover:underline"
                    >
                      {row.postUrl}
                    </a>
                    {row.status === "rejected" && row.rejectionReason ? (
                      <p className="text-xs text-destructive">
                        {t("creator.rejectionReason", { reason: row.rejectionReason })}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="submission" value={row.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.views === null ? t("common.notApplicable") : fmtNumber(row.views)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {row.estimatedEarningsCents === null
                      ? t("common.notApplicable")
                      : fmtMoney(row.estimatedEarningsCents)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {fmtDate(row.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title={t("creator.emptySubmissions")}
          action={
            <Button asChild>
              <Link href="/creator/campaigns">{t("creator.submitButton")}</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
