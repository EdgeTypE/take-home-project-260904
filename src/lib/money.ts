// Money is stored as integer cents everywhere. One formatter renders it
// consistently, with tabular figures so columns of amounts line up.
const usdFormatterCache = new Map<string, Intl.NumberFormat>();

function usdFormatter(locale: string): Intl.NumberFormat {
  let formatter = usdFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    usdFormatterCache.set(locale, formatter);
  }
  return formatter;
}

export function formatMoneyCents(cents: number, locale: string = "en"): string {
  return usdFormatter(locale).format(cents / 100);
}
