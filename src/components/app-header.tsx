"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-provider";
import { trpc } from "@/lib/trpc/client";
import { switchDemoUser } from "@/lib/switch-user";
import type { Lang } from "@/lib/i18n/dictionaries";

export function AppHeader() {
  const { t, lang, setLang } = useI18n();
  const queryClient = useQueryClient();
  const whoami = trpc.dev.whoami.useQuery();
  const users = trpc.dev.listUsers.useQuery();
  const [pendingUserId, setPendingUserId] = useState<string>("");
  const [switching, setSwitching] = useState(false);

  const currentUser = whoami.data;
  const admins = users.data?.filter((row) => row.role === "admin") ?? [];
  const creators = users.data?.filter((row) => row.role === "creator") ?? [];

  const handleSwitch = async (userId: string) => {
    if (!userId || userId === currentUser?.id) {
      return;
    }
    setSwitching(true);
    try {
      await switchDemoUser(userId);
      // The signed cookie changed: refetch everything currently mounted so no
      // data from the previous demo user lingers (header identity, role guard,
      // current page queries). Inactive queries refetch when next mounted.
      await queryClient.invalidateQueries();
    } finally {
      setSwitching(false);
      setPendingUserId("");
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 md:px-6">
        <Link href="/" className="flex items-baseline gap-2 font-semibold">
          {t("common.appName")}
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            {t("common.tagline")}
          </span>
        </Link>

        <nav className="ml-2 flex items-center gap-1 text-sm" aria-label="Main">
          {currentUser?.role === "admin" ? (
            <>
              <Link
                href="/admin/campaigns"
                className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t("nav.campaigns")}
              </Link>
              <Link
                href="/admin/campaigns/new"
                className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t("nav.newCampaign")}
              </Link>
            </>
          ) : null}
          {currentUser?.role === "creator" ? (
            <>
              <Link
                href="/creator/campaigns"
                className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t("nav.campaigns")}
              </Link>
              <Link
                href="/creator/submissions"
                className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t("nav.mySubmissions")}
              </Link>
            </>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Select
            value={lang}
            onValueChange={(value) => setLang(value as Lang)}
            aria-label={t("common.language")}
          >
            <SelectTrigger className="h-8 w-28 text-xs" aria-label={t("common.language")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("common.english")}</SelectItem>
              <SelectItem value="tr">{t("common.turkish")}</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline" aria-live="polite">
              {currentUser
                ? t("header.viewingAs", {
                    email: currentUser.email,
                    role: t(`roles.${currentUser.role}`),
                  })
                : t("home.notSignedIn")}
            </span>
            <Select
              value={pendingUserId || currentUser?.id || undefined}
              onValueChange={(value) => {
                setPendingUserId(value);
                void handleSwitch(value);
              }}
              disabled={switching}
              aria-label={t("header.switchUser")}
            >
              <SelectTrigger className="h-8 w-44 text-xs" aria-label={t("header.switchUser")}>
                <SelectValue placeholder={t("header.switchUser")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{t("roles.admin")}</SelectLabel>
                  {admins.map((admin) => (
                    <SelectItem key={admin.id} value={admin.id}>
                      {admin.email}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>{t("roles.creator")}</SelectLabel>
                  {creators.map((creator) => (
                    <SelectItem key={creator.id} value={creator.id}>
                      {creator.email}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </header>
  );
}
