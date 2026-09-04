"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANG,
  dictionaries,
  getClientCookie,
  isLang,
  LANGUAGE_COOKIE,
  localeForLang,
  setClientCookie,
  type Lang,
} from "@/lib/i18n/dictionaries";

export interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  fmtMoney: (cents: number) => string;
  fmtNumber: (value: number) => string;
  fmtDate: (value: string | Date) => string;
  fmtDateTime: (value: string | Date) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function resolveKey(dictionary: Record<string, unknown>, key: string): string {
  let cursor: unknown = dictionary;
  for (const segment of key.split(".")) {
    if (typeof cursor !== "object" || cursor === null) {
      return key;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return typeof cursor === "string" ? cursor : key;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

export function I18nProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (initialLang) {
      return initialLang;
    }
    const cookieLang = getClientCookie(LANGUAGE_COOKIE);
    return isLang(cookieLang) ? cookieLang : DEFAULT_LANG;
  });

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    setClientCookie(LANGUAGE_COOKIE, next);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dictionary = dictionaries[lang] as unknown as Record<string, unknown>;
    const locale = localeForLang(lang);
    const moneyFormatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const numberFormatter = new Intl.NumberFormat(locale);
    const dateFormatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const dateTimeFormatter = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      lang,
      setLang,
      t: (key: string, vars) => interpolate(resolveKey(dictionary, key), vars),
      fmtMoney: (cents) => moneyFormatter.format(cents / 100),
      fmtNumber: (value) => numberFormatter.format(value),
      fmtDate: (value) => dateFormatter.format(new Date(value)),
      fmtDateTime: (value) => dateTimeFormatter.format(new Date(value)),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return value;
}
