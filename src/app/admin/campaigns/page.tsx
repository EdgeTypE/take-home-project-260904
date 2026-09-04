"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleGuard } from "@/components/role-guard";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/page-alert";
import { useI18n } from "@/components/i18n-provider";
import { trpc } from "@/lib/trpc/client";

const PAGE_SIZE = 8;

export default function AdminCampaignsPage() {
  return (
    <RoleGuard role="admin">
      <CampaignList />
    </RoleGuard>
  );
}

function CampaignList() {
  const { t, fmtMoney, fmtDate } = useI18n();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const campaigns = trpc.campaign.list.useQuery(
    {
      page,
      pageSize: PAGE_SIZE,
      search: appliedSearch || undefined,
      status: status === "all" ? undefined : (status as "draft" | "active" | "paused" | "completed"),
    },
  );

  const total = campaigns.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = appliedSearch.length > 0 || status !== "all";

  const clearFilters = () => {
    setSearch("");
    setAppliedSearch("");
    setStatus("all");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("admin.campaignsTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.campaignsDescription")}</p>
        </div>
        <Button asChild>
          <Link href="/admin/campaigns/new">
            <Plus className="size-4" aria-hidden />
            {t("admin.newCampaign")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="pl-9"
            placeholder={t("admin.searchPlaceholder")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            aria-label={t("admin.searchPlaceholder")}
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44" aria-label={t("admin.filterAll")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.filterAll")}</SelectItem>
            <SelectItem value="draft">{t("statuses.campaign.draft")}</SelectItem>
            <SelectItem value="active">{t("statuses.campaign.active")}</SelectItem>
            <SelectItem value="paused">{t("statuses.campaign.paused")}</SelectItem>
            <SelectItem value="completed">{t("statuses.campaign.completed")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {campaigns.isError ? (
        <ErrorAlert
          title={t("errors.INTERNAL_SERVER_ERROR")}
          onRetry={() => campaigns.refetch()}
        />
      ) : null}

      {campaigns.isLoading || campaigns.isFetching ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : campaigns.data && campaigns.data.items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.fieldTitle")}</TableHead>
                <TableHead>{t("admin.fieldStatus")}</TableHead>
                <TableHead>{t("admin.labelBudget")}</TableHead>
                <TableHead>{t("admin.labelSpent")}</TableHead>
                <TableHead className="text-right">{t("admin.labelLeft")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.data.items.map((campaign) => (
                <TableRow key={campaign.id} className="group">
                  <TableCell className="max-w-[18rem]">
                    <Link
                      href={`/admin/campaigns/${campaign.id}`}
                      className="font-medium underline-offset-4 group-hover:underline"
                    >
                      {campaign.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {campaign.platforms.map((platform) => t(`platforms.${platform}`)).join(", ")}
                      <span aria-hidden> · </span>
                      {t("common.perThousand", {
                        amount: fmtMoney(campaign.payoutPer1kViewsCents),
                      })}
                      <span aria-hidden> · </span>
                      {fmtDate(campaign.startsAt)} - {fmtDate(campaign.endsAt)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="campaign" value={campaign.status} />
                  </TableCell>
                  <TableCell>{fmtMoney(campaign.totalBudgetCents)}</TableCell>
                  <TableCell>{fmtMoney(campaign.budgetSpentCents)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {campaign.budgetLeftCents === 0 ? (
                      <span className="text-muted-foreground">{t("common.notApplicable")}</span>
                    ) : (
                      fmtMoney(campaign.budgetLeftCents)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          title={t("admin.emptySearch")}
          action={
            hasFilters ? (
              <Button variant="outline" onClick={clearFilters}>
                {t("admin.clearFilters")}
              </Button>
            ) : (
              <Button asChild>
                <Link href="/admin/campaigns/new">{t("admin.newCampaign")}</Link>
              </Button>
            )
          }
        />
      )}

      {campaigns.data && campaigns.data.items.length > 0 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t("admin.campaignsTitle")}: {campaigns.data.total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t("common.previous")}
            </Button>
            <span className="tabular-nums">
              {t("common.pageOf", { page, totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              {t("common.next")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
