/** Pure helpers for chart data (UTC day/month buckets, zero-filled). */

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** Last `days` UTC days ending today, each with count/sum of matching rows (zero-filled). */
export function bucketByDay<T>(rows: T[], getDate: (r: T) => Date, days: number, now: Date, getValue: (r: T) => number = () => 1) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) buckets.set(dayKey(new Date(end.getTime() - i * DAY_MS)), 0);
  for (const r of rows) {
    const k = dayKey(getDate(r));
    if (buckets.has(k)) buckets.set(k, buckets.get(k)! + getValue(r));
  }
  return [...buckets.entries()].map(([date, value]) => ({ date, value }));
}

/** Last `months` UTC months ending this month (zero-filled). */
export function bucketByMonth<T>(rows: T[], getDate: (r: T) => Date, months: number, now: Date, getValue: (r: T) => number = () => 1) {
  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    buckets.set(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))), 0);
  }
  for (const r of rows) {
    const k = monthKey(getDate(r));
    if (buckets.has(k)) buckets.set(k, buckets.get(k)! + getValue(r));
  }
  return [...buckets.entries()].map(([month, value]) => ({ month, value }));
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
