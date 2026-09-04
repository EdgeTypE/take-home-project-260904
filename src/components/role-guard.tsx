"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-provider";
import { trpc } from "@/lib/trpc/client";

export function RoleGuard({
  role,
  children,
}: {
  role: "admin" | "creator";
  children: ReactNode;
}) {
  const { t } = useI18n();
  const whoami = trpc.dev.whoami.useQuery();

  if (whoami.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (whoami.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("common.loading")}</AlertTitle>
        <AlertDescription>{t("errors.INTERNAL_SERVER_ERROR")}</AlertDescription>
      </Alert>
    );
  }

  if (!whoami.data) {
    return (
      <Alert>
        <AlertTitle>{t("common.signInPrompt")}</AlertTitle>
        <AlertDescription>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/">{t("common.retry")}</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (whoami.data.role !== role) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("errors.FORBIDDEN")}</AlertTitle>
        <AlertDescription>
          <Button asChild variant="outline" className="mt-2">
            <Link href="/">{t("home.notSignedIn")}</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return <>{children}</>;
}
