"use client";

import type { ReactNode } from "react";
import { TRPCProvider } from "@/components/trpc-provider";
import { I18nProvider, useI18n } from "@/components/i18n-provider";
import { AppHeader } from "@/components/app-header";
import type { Lang } from "@/lib/i18n/dictionaries";

export function SiteShell({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  return (
    <TRPCProvider>
      <I18nProvider initialLang={initialLang}>
        <ShellInner>{children}</ShellInner>
      </I18nProvider>
    </TRPCProvider>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-6 md:px-6">
        {children}
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        {t("common.footer")}
      </footer>
    </div>
  );
}
