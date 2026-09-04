"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useI18n } from "@/components/i18n-provider";
import { ErrorAlert } from "@/components/page-alert";
import { useLocalizedError } from "@/components/use-error-message";
import { trpc } from "@/lib/trpc/client";
import { PLATFORM_VALUES, type Platform } from "@/lib/platforms";
import { datetimeLocalToIso, isoToDatetimeLocal } from "@/lib/datetime-local";
import { campaignCreateSchema } from "@/lib/schemas/campaign";

const formSchema = z.object({
  title: z.string().trim().min(3).max(120),
  platforms: z.array(z.string()).min(1),
  payoutPer1k: z.string().min(1, "Required"),
  totalBudget: z.string().min(1, "Required"),
  startsAt: z.string().min(1, "Required"),
  endsAt: z.string().min(1, "Required"),
  status: z.enum(["draft", "active", "paused"]).optional(),
});

type FormValues = z.infer<typeof formSchema>;

function dollarsToCents(dollars: string): number {
  return Math.round(Number.parseFloat(dollars) * 100);
}

export function CampaignForm({ campaignId }: { campaignId?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const localizedError = useLocalizedError();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEdit = campaignId !== undefined;
  const detail = trpc.campaign.getById.useQuery(
    { id: campaignId ?? "" },
    { enabled: isEdit },
  );

  const createCampaign = trpc.campaign.create.useMutation();
  const updateCampaign = trpc.campaign.update.useMutation();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      platforms: [],
      payoutPer1k: "5.00",
      totalBudget: "100.00",
      startsAt: "",
      endsAt: "",
      status: "draft",
    },
  });

  const [originalStatus, setOriginalStatus] = useState<
    "draft" | "active" | "paused" | "completed" | undefined
  >(undefined);
  const { reset } = form;
  useEffect(() => {
    if (detail.data) {
      setOriginalStatus(detail.data.status);
      reset({
        title: detail.data.title,
        platforms: detail.data.platforms as string[],
        payoutPer1k: (detail.data.payoutPer1kViewsCents / 100).toFixed(2),
        totalBudget: (detail.data.totalBudgetCents / 100).toFixed(2),
        startsAt: isoToDatetimeLocal(detail.data.startsAt),
        endsAt: isoToDatetimeLocal(detail.data.endsAt),
        // Completed is not a manual state; keep the editable list at draft..paused.
        status:
          detail.data.status === "completed"
            ? undefined
            : (detail.data.status as FormValues["status"]),
      });
    }
  }, [detail.data, reset]);

  const busy = createCampaign.isPending || updateCampaign.isPending || detail.isLoading;
  const platformOptions = useMemo<Platform[]>(() => [...PLATFORM_VALUES], []);

  function onSubmit(values: FormValues) {
    setSubmitError(null);
    const payload = {
      title: values.title,
      platforms: values.platforms as Platform[],
      payoutPer1kViewsCents: dollarsToCents(values.payoutPer1k),
      totalBudgetCents: dollarsToCents(values.totalBudget),
      startsAt: datetimeLocalToIso(values.startsAt),
      endsAt: datetimeLocalToIso(values.endsAt),
    };
    const parsed = campaignCreateSchema.safeParse(payload);
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? t("errors.UNKNOWN"));
      return;
    }
    if (isEdit) {
      // Completed is terminal: editing a completed campaign never flips it
      // back unless the admin explicitly picks another status.
      const statusChanged =
        originalStatus && originalStatus !== "completed" && values.status !== originalStatus;
      updateCampaign.mutate(
        {
          id: campaignId!,
          data: statusChanged ? { ...parsed.data, status: values.status } : parsed.data,
        },
        {
          onSuccess: () => router.push(`/admin/campaigns/${campaignId!}`),
          onError: (err) => setSubmitError(localizedError(err)),
        },
      );
    } else {
      createCampaign.mutate(parsed.data, {
        onSuccess: (campaign) => router.push(`/admin/campaigns/${campaign.id}`),
        onError: (err) => setSubmitError(localizedError(err)),
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {submitError ? <ErrorAlert title={t("errors.UNKNOWN")} description={submitError} /> : null}

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("admin.fieldTitle")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("admin.placeholderTitle")}
                  aria-label={t("admin.fieldTitle")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="platforms"
          render={() => (
            <FormItem>
              <FormLabel>{t("admin.fieldPlatforms")}</FormLabel>
              <div className="flex flex-wrap gap-4">
                {platformOptions.map((platform) => (
                  <FormField
                    key={platform}
                    control={form.control}
                    name="platforms"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value.includes(platform)}
                            onCheckedChange={(checked) => {
                              const next = checked
                                ? [...field.value, platform]
                                : field.value.filter((value) => value !== platform);
                              field.onChange(next);
                            }}
                            aria-label={t(`platforms.${platform}`)}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {t(`platforms.${platform}`)}
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="payoutPer1k"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.fieldPayout")}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      className="pl-7"
                      aria-label={t("admin.fieldPayout")}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="totalBudget"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.fieldBudget")}</FormLabel>
                <FormControl>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      className="pl-7"
                      aria-label={t("admin.fieldBudget")}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.fieldStarts")}</FormLabel>
                <FormControl>
                  <Input type="datetime-local" aria-label={t("admin.fieldStarts")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.fieldEnds")}</FormLabel>
                <FormControl>
                  <Input type="datetime-local" aria-label={t("admin.fieldEnds")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {isEdit ? (
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.fieldStatus")}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger aria-label={t("admin.fieldStatus")}>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="draft">{t("statuses.campaign.draft")}</SelectItem>
                    <SelectItem value="active">{t("statuses.campaign.active")}</SelectItem>
                    <SelectItem value="paused">{t("statuses.campaign.paused")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {isEdit ? t("common.save") : t("common.submit")}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
