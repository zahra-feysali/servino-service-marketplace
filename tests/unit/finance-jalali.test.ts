import { describe, expect, it } from "vitest";
import {
  bpsToPercent,
  canPayOrder,
  computeSplit,
  percentToBps,
  requiresPaymentBefore,
  settlementActionFor,
} from "@/features/finance/rules";
import {
  addJalaliMonths,
  formatIsoAsJalali,
  formatIsoAsJalaliLong,
  isoToJalali,
  jalaliMonthDays,
  jalaliMonthStartWeekday,
  jalaliToIso,
  parseJalaliString,
  startOfTehranDay,
  tehranDateRange,
  todayIsoInTehran,
} from "@/lib/jalali";

describe("commission math", () => {
  it("splits 10% exactly and keeps the sum equal to the gross amount", () => {
    expect(computeSplit(850_000, 1_000)).toEqual({ grossAmount: 850_000, commissionRateBps: 1_000, commissionAmount: 85_000, providerAmount: 765_000 });
  });

  it.each([
    [1_000, 1_250, 125],
    [999, 1_000, 100], // 99.9 → 100 (half-up)
    [995, 1_000, 100], // 99.5 → 100
    [994, 1_000, 99], // 99.4 → 99
    [123_457, 755, 9_321], // 7.55%
    [0, 1_000, 0],
    [500_000, 0, 0],
  ])("gross %i at %i bps → commission %i", (gross, bps, commission) => {
    const s = computeSplit(gross, bps);
    expect(s.commissionAmount).toBe(commission);
    expect(s.commissionAmount + s.providerAmount).toBe(gross);
  });

  it("rejects invalid rates and amounts", () => {
    expect(() => computeSplit(1000, -1)).toThrow("INVALID_RATE");
    expect(() => computeSplit(1000, 5_001)).toThrow("INVALID_RATE");
    expect(() => computeSplit(10.5, 1000)).toThrow("INVALID_AMOUNT");
    expect(() => computeSplit(-1, 1000)).toThrow("INVALID_AMOUNT");
  });

  it("converts percent ↔ basis points", () => {
    expect(percentToBps(10)).toBe(1_000);
    expect(percentToBps(12.5)).toBe(1_250);
    expect(percentToBps(7.555)).toBe(756);
    expect(bpsToPercent(1_250)).toBe(12.5);
    expect(() => percentToBps(51)).toThrow();
    expect(() => percentToBps(-1)).toThrow();
  });
});

describe("order payment rules", () => {
  const order = { customerId: "c1", status: "ACCEPTED", paymentStatus: "UNPAID" as const };
  it("only the owner can pay an active unpaid order", () => {
    expect(canPayOrder(order, "c1")).toBeNull();
    expect(canPayOrder(order, "c2")).toBe("NOT_OWNER");
    expect(canPayOrder({ ...order, paymentStatus: "PAID" }, "c1")).toBe("ALREADY_PAID");
    expect(canPayOrder({ ...order, paymentStatus: "REFUNDED" }, "c1")).toBe("ALREADY_PAID");
    expect(canPayOrder({ ...order, status: "CANCELLED" }, "c1")).toBe("NOT_PAYABLE");
    expect(canPayOrder({ ...order, status: "COMPLETED" }, "c1")).toBe("NOT_PAYABLE");
    expect(canPayOrder({ ...order, status: "DISPUTED" }, "c1")).toBe("NOT_PAYABLE");
  });

  it("requires payment before work starts and maps escrow actions", () => {
    expect(requiresPaymentBefore("ACCEPTED")).toBe(false);
    expect(requiresPaymentBefore("IN_PROGRESS")).toBe(true);
    expect(requiresPaymentBefore("COMPLETED")).toBe(true);
    expect(settlementActionFor("COMPLETED")).toBe("RELEASE");
    expect(settlementActionFor("CANCELLED")).toBe("REFUND");
    expect(settlementActionFor("DISPUTED")).toBeNull();
  });
});

describe("Jalali ↔ Gregorian conversion", () => {
  it.each([
    ["2026-03-21", 1405, 1, 1], // Nowruz 1405
    ["2025-03-21", 1404, 1, 1],
    ["2026-11-18", 1405, 8, 27],
    ["2024-03-19", 1402, 12, 29],
    ["2025-03-20", 1403, 12, 30], // 1403 is a leap year (Esfand has 30 days)
    ["2000-01-01", 1378, 10, 11],
    ["2079-03-21", 1458, 1, 1],
    ["2029-03-20", 1408, 1, 1], // Nowruz on 20 March
  ])("%s ⇄ %i/%i/%i", (iso, jy, jm, jd) => {
    expect(isoToJalali(iso)).toEqual({ jy, jm, jd });
    expect(jalaliToIso(jy, jm, jd)).toBe(iso);
  });

  it("round-trips every day of several years and agrees with Intl's Persian calendar", () => {
    const fmt = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" });
    for (let t = Date.UTC(2023, 0, 1); t < Date.UTC(2028, 0, 1); t += 86_400_000) {
      const iso = new Date(t).toISOString().slice(0, 10);
      const j = isoToJalali(iso);
      expect(jalaliToIso(j.jy, j.jm, j.jd)).toBe(iso);
      const parts = Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
      expect([Number(parts.year), Number(parts.month), Number(parts.day)]).toEqual([j.jy, j.jm, j.jd]);
    }
  });

  it("rejects dates that do not exist", () => {
    expect(jalaliToIso(1404, 12, 30)).toBeNull(); // 1404 is not leap
    expect(jalaliToIso(1405, 7, 31)).toBeNull(); // second half months have 30 days
    expect(jalaliToIso(1405, 13, 1)).toBeNull();
    expect(() => isoToJalali("2026-02-30")).toThrow();
  });

  it("parses Persian/Latin input and formats with Persian digits", () => {
    expect(parseJalaliString("۱۴۰۵/۰۸/۲۷")).toBe("2026-11-18");
    expect(parseJalaliString("1405-8-27")).toBe("2026-11-18");
    expect(parseJalaliString("1405/12/30")).toBeNull();
    expect(parseJalaliString("hello")).toBeNull();
    expect(formatIsoAsJalali("2026-11-18")).toBe("۱۴۰۵/۰۸/۲۷");
    expect(formatIsoAsJalaliLong("2026-03-21")).toBe("۱ فروردین ۱۴۰۵");
  });

  it("computes month lengths, start weekday and month arithmetic", () => {
    expect(jalaliMonthDays(1405, 1)).toBe(31);
    expect(jalaliMonthDays(1405, 7)).toBe(30);
    expect(jalaliMonthDays(1403, 12)).toBe(30);
    expect(jalaliMonthDays(1404, 12)).toBe(29);
    expect(jalaliMonthStartWeekday(1405, 1)).toBe(0); // 1 Farvardin 1405 = Saturday 21 March 2026
    expect(addJalaliMonths(1405, 12, 1)).toEqual({ jy: 1406, jm: 1 });
    expect(addJalaliMonths(1405, 1, -1)).toEqual({ jy: 1404, jm: 12 });
  });

  it("uses Iran day boundaries for filters", () => {
    expect(startOfTehranDay("2026-11-18").toISOString()).toBe("2026-11-17T20:30:00.000Z");
    const r = tehranDateRange("2026-11-01", "2026-11-18");
    expect(r.from?.toISOString()).toBe("2026-10-31T20:30:00.000Z");
    expect(r.to?.toISOString()).toBe("2026-11-18T20:30:00.000Z");
    expect(tehranDateRange("2026-11-18", "2026-11-01")).toEqual({});
    expect(tehranDateRange("bad", undefined)).toEqual({});
    expect(todayIsoInTehran(new Date("2026-11-17T21:00:00Z"))).toBe("2026-11-18");
  });
});
