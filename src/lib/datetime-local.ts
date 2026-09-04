// <input type="datetime-local"> works in the browser's local time zone while
// the API speaks ISO-8601 with an offset, so the two conversions below are the
// single place that translation happens.
export function isoToDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function datetimeLocalToIso(value: string): string {
  return new Date(value).toISOString();
}
