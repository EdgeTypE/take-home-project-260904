"use client";

import { useCallback } from "react";
import { useI18n } from "@/components/i18n-provider";
import { getErrorCause, getErrorMessage } from "@/lib/trpc/error";

export function useLocalizedError() {
  const { t, fmtMoney } = useI18n();

  return useCallback(
    (err: unknown): string => {
      const cause = getErrorCause(err);
      const reason = cause?.reason;
      const key = reason ? `errors.${reason}` : undefined;
      if (key) {
        const localized = t(key);
        // Fall back on the server message when the key is unknown to this locale.
        if (localized !== key) {
          if (reason === "BUDGET_EXCEEDED" && cause?.remainingCents !== undefined) {
            return localized.replace("{amount}", fmtMoney(cause.remainingCents));
          }
          return localized;
        }
      }
      const fallback = getErrorMessage(err);
      if (fallback) {
        return fallback;
      }
      return t("errors.UNKNOWN");
    },
    [t, fmtMoney],
  );
}
