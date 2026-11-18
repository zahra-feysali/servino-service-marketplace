import { isValidJalaaliDate, jalaaliMonthLength, toGregorian, toJalaali } from "jalaali-js";
import { toEnglishDigits, toPersianDigits } from "@/lib/utils";

/**
 * Jalali (Persian / Solar Hijri) calendar helpers.
 *
 * Storage rule (unchanged architecture): the database stores Gregorian dates —
 * date-only values as ISO `YYYY-MM-DD` (saved as UTC midnight) and timestamps as UTC.
 * The UI shows and accepts Jalali dates; conversion uses the standard Borkowski algorithm
 * (`jalaali-js`), which is exact for the supported range.
 */

export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
] as const;

/** Week starts on Saturday in Iran. */
export const JALALI_WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"] as const;

export type JalaliDate = { jy: number; jm: number; jd: number };

const pad = (n: number) => String(n).padStart(2, "0");

export function isIsoDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Gregorian ISO date → Jalali parts. */
export function isoToJalali(iso: string): JalaliDate {
  if (!isIsoDateString(iso)) throw new Error("INVALID_DATE");
  const [gy, gm, gd] = iso.split("-").map(Number);
  return toJalaali(gy, gm, gd);
}

/** Jalali parts → Gregorian ISO date, or null when the Jalali date does not exist. */
export function jalaliToIso(jy: number, jm: number, jd: number): string | null {
  if (!isValidJalaaliDate(jy, jm, jd)) return null;
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return `${gy}-${pad(gm)}-${pad(gd)}`;
}

/** "۱۴۰۵/۰۸/۲۷", "1405-8-27" … → Gregorian ISO, or null if invalid. */
export function parseJalaliString(input: string): string | null {
  const m = toEnglishDigits(input.trim()).match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (!m) return null;
  return jalaliToIso(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Gregorian ISO → "۱۴۰۵/۰۸/۲۷" (Persian digits). */
export function formatIsoAsJalali(iso: string): string {
  const { jy, jm, jd } = isoToJalali(iso);
  return toPersianDigits(`${jy}/${pad(jm)}/${pad(jd)}`);
}

/** Gregorian ISO → "۲۷ آبان ۱۴۰۵". */
export function formatIsoAsJalaliLong(iso: string): string {
  const { jy, jm, jd } = isoToJalali(iso);
  return toPersianDigits(`${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`);
}

export function jalaliMonthDays(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm);
}

/** Index (0 = Saturday … 6 = Friday) of the weekday on which a Jalali month starts. */
export function jalaliMonthStartWeekday(jy: number, jm: number): number {
  const { gy, gm, gd } = toGregorian(jy, jm, 1);
  const jsDay = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay(); // 0 = Sunday
  return (jsDay + 1) % 7;
}

/** Shifts a Jalali month by `delta` months. */
export function addJalaliMonths(jy: number, jm: number, delta: number): { jy: number; jm: number } {
  const index = jy * 12 + (jm - 1) + delta;
  return { jy: Math.floor(index / 12), jm: (index % 12) + 1 };
}

/** Today's date in Iran (Asia/Tehran) as Gregorian ISO — independent of server/browser time zone. */
export function todayIsoInTehran(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Start of an Iran calendar day (UTC instant), for date-range filters on timestamps. */
export function startOfTehranDay(iso: string): Date {
  if (!isIsoDateString(iso)) throw new Error("INVALID_DATE");
  return new Date(`${iso}T00:00:00+03:30`);
}

/**
 * Inclusive Jalali date-range filter → half-open UTC range [from, to).
 * Invalid or reversed values are ignored.
 */
export function tehranDateRange(fromIso?: string | null, toIso?: string | null): { from?: Date; to?: Date } {
  const range: { from?: Date; to?: Date } = {};
  if (fromIso && isIsoDateString(fromIso)) range.from = startOfTehranDay(fromIso);
  if (toIso && isIsoDateString(toIso)) range.to = new Date(startOfTehranDay(toIso).getTime() + 24 * 60 * 60 * 1000);
  if (range.from && range.to && range.from >= range.to) return {};
  return range;
}
