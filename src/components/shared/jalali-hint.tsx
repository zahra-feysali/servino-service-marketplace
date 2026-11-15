"use client";

import { isIsoDate } from "@/features/forms/definitions";

const fmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

/**
 * Shows the Persian (Jalali) equivalent of a `<input type="date">` value, because native
 * browser date pickers use the Gregorian calendar. Values are still sent as ISO dates.
 */
export function JalaliHint({ value }: { value: unknown }) {
  if (typeof value !== "string" || !isIsoDate(value)) return null;
  return (
    <p className="text-xs text-primary" aria-live="polite">
      معادل شمسی: {fmt.format(new Date(`${value}T00:00:00Z`))}
    </p>
  );
}
