// Metric rows are keyed by calendar date; the ingest script writes the UTC
// date, so every day derived from a timestamp uses the same UTC cut.
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayUtc(): string {
  return toDateOnly(new Date());
}

export function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function enumerateDays(startDateOnly: string, endDateOnly: string): string[] {
  const days: string[] = [];
  let cursor = startDateOnly;
  while (cursor <= endDateOnly) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}
