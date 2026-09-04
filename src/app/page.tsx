"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import { trpc } from "@/lib/trpc/client";
import { switchDemoUser } from "@/lib/switch-user";

export default function HomePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [switchingRole, setSwitchingRole] = useState<"admin" | "creator" | null>(null);
  const whoami = trpc.dev.whoami.useQuery();
  const users = trpc.dev.listUsers.useQuery();

  const admin = users.data?.find((user) => user.role === "admin");
  const creator = users.data?.find((user) => user.role === "creator");

  const enter = async (role: "admin" | "creator", userId: string | undefined) => {
    if (!userId) {
      return;
    }
    if (userId !== whoami.data?.id) {
      setSwitchingRole(role);
      await switchDemoUser(userId);
    }
    router.push(role === "admin" ? "/admin/campaigns" : "/creator/campaigns");
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-8 py-10 text-center">
      <div className="space-y-2">
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          {t("home.headline")}
        </h1>
        <p className="text-muted-foreground">{t("common.signInPrompt")}</p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2" aria-live="polite">
        <Card className="text-left">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-4" aria-hidden />
              {t("home.adminTitle")}
            </CardTitle>
            <CardDescription>{t("home.adminDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => enter("admin", admin?.id)}
              disabled={!admin || switchingRole !== null}
            >
              {switchingRole === "admin" ? t("common.loading") : t("home.enterAs", { name: admin?.email ?? "admin" })}
            </Button>
          </CardContent>
        </Card>

        <Card className="text-left">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="size-4" aria-hidden />
              {t("home.creatorTitle")}
            </CardTitle>
            <CardDescription>{t("home.creatorDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => enter("creator", creator?.id)}
              disabled={!creator || switchingRole !== null}
            >
              {switchingRole === "creator" ? t("common.loading") : t("home.enterAs", { name: creator?.email ?? "creator" })}
            </Button>
          </CardContent>
        </Card>
      </div>

      {whoami.data ? (
        <p className="text-sm text-muted-foreground">
          {t("header.viewingAs", {
            email: whoami.data.email,
            role: t(`roles.${whoami.data.role}`),
          })}
        </p>
      ) : null}
    </div>
  );
}
