"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ErrorAlert, SuccessAlert } from "@/components/page-alert";
import { useI18n } from "@/components/i18n-provider";
import { useLocalizedError } from "@/components/use-error-message";
import { trpc } from "@/lib/trpc/client";

const urlSchema = z.object({
  postUrl: z.string().trim().url("Enter a full post URL"),
});

export default function CreatorCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGuard role="creator">
      <CampaignSubmit campaignId={id} />
    </RoleGuard>
  );
}

function CampaignSubmit({ campaignId }: { campaignId: string }) {
  const { t, fmtMoney, fmtDate, fmtNumber } = useI18n();
  const localizedError = useLocalizedError();
  const utils = trpc.useUtils();
  const [success, setSuccess] = useState(false);

  const detail = trpc.campaign.getById.useQuery({ id: campaignId });
  const mine = trpc.submission.myList.useQuery({ page: 1, pageSize: 50 });

  const form = useForm<z.infer<typeof urlSchema>>({
    resolver: zodResolver(urlSchema),
    defaultValues: { postUrl: "" },
  });

  const create = trpc.submission.create.useMutation({
    onSuccess: () => {
      form.reset();
      setSuccess(true);
      utils.submission.myList.invalidate();
    },
  });
  const submitError = create.error ? localizedError(create.error) : null;

  if (detail.isError) {
    return <ErrorAlert title={t("errors.CAMPAIGN_NOT_FOUND")} />;
  }

  if (detail.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const campaign = detail.data!;
  const myRows = (mine.data?.items ?? []).filter((row) => row.campaignId === campaign.id);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href="/creator/campaigns" className="text-sm text-muted-foreground hover:underline">
          ← {t("nav.campaigns")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{campaign.title}</h1>
        {/* div, not p: Badge renders a div, and a div inside a p is invalid HTML
            that trips React's hydration check. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("common.perThousand", { amount: fmtMoney(campaign.payoutPer1kViewsCents) })}
          </span>
          {campaign.platforms.map((platform) => (
            <Badge key={platform} variant="outline" className="font-normal text-xs">
              {t(`platforms.${platform}`)}
            </Badge>
          ))}
          <span>{t("creator.campaignEnds", { date: fmtDate(campaign.endsAt) })}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("creator.submitTitle")}</CardTitle>
          <CardDescription>{t("creator.submitDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? <SuccessAlert title={t("creator.submitted")} /> : null}
          <form
            onSubmit={form.handleSubmit((values) =>
              create.mutate(
                { campaignId, postUrl: values.postUrl },
                {
                  onError: (err) => {
                    setSuccess(false);
                    localizedError(err);
                  },
                },
              ),
            )}
            className="space-y-3"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="post-url">{t("creator.urlLabel")}</Label>
              <Input
                id="post-url"
                type="url"
                placeholder={t("creator.urlPlaceholder")}
                aria-invalid={Boolean(form.formState.errors.postUrl)}
                {...form.register("postUrl")}
              />
              {form.formState.errors.postUrl ? (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.postUrl.message}
                </p>
              ) : null}
              {create.error && submitError ? (
                <ErrorAlert title={t("errors.UNKNOWN")} description={submitError} />
              ) : null}
            </div>
            <Button type="submit" disabled={create.isPending}>
              {t("creator.submitButton")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="mine-heading">
        <h2 id="mine-heading" className="mb-3 text-lg font-semibold tracking-tight">
          {t("creator.yourSubsTitle")}
        </h2>
        {mine.isLoading ? (
          <Skeleton className="h-32 w-full" aria-busy="true" />
        ) : myRows.length > 0 ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("creator.clipColumn")}</TableHead>
                  <TableHead>{t("creator.statusColumn")}</TableHead>
                  <TableHead className="text-right">{t("creator.viewsColumn")}</TableHead>
                  <TableHead className="text-right">{t("creator.earningsColumn")}</TableHead>
                  <TableHead>{t("creator.submittedColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-[18rem]">
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
              <Button asChild variant="outline">
                <Link href="/creator/campaigns">{t("creator.campaignsTitle")}</Link>
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
