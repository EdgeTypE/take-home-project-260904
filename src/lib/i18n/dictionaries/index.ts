import { en, type Messages } from "./en";
import { tr } from "./tr";

export type Lang = "en" | "tr";
export type MessageKey = DeepKey<Messages>;

export const dictionaries: Record<Lang, Messages> = { en, tr };

// Dot-path key union over the nested message tree, e.g. "admin.queueEmpty".
type DeepKey<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends string
        ? K
        : `${K}.${DeepKey<T[K]>}`;
    }[keyof T & string]
  : never;

export const LANGUAGE_COOKIE = "clipboard_lang";
export const DEFAULT_LANG: Lang = "en";

export function isLang(value: string | undefined): value is Lang {
  return value === "en" || value === "tr";
}

export function localeForLang(lang: Lang): string {
  return lang === "tr" ? "tr-TR" : "en-US";
}

export function getClientCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  return match?.slice(name.length + 1);
}

export function setClientCookie(name: string, value: string): void {
  document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
