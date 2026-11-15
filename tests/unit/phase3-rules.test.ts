import { describe, expect, it } from "vitest";
import { addressInputSchema } from "@/features/addresses/schemas";
import { featuredInputSchema, isFeaturedLive, orderProviders, type FeaturedEntry } from "@/features/featured/rules";
import {
  canCompleteSimulatedPayment,
  simulatedTrackingCode,
  topUpSchema,
  walletBalanceAfterCredit,
  walletBalanceAfterDebit,
} from "@/features/payments/rules";
import { canReview, canSubmitForVerification, verificationChecklist } from "@/features/providers/verification";
import { bucketByDay, bucketByMonth } from "@/features/reports/aggregate";
import { computeSubscriptionWindow, extendEndDate, planInputSchema, planToSnapshot, shouldExpire } from "@/features/subscriptions/lifecycle";
import { parsePlanSnapshot } from "@/features/subscriptions/quota";
import { statusAfterMessage, ticketCreateSchema } from "@/features/tickets/rules";
import { maskName } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-15T12:00:00Z");

describe("subscription lifecycle", () => {
  it("starts now when there is no active subscription", () => {
    const w = computeSubscriptionWindow(now, [], 30);
    expect(w.startsAt).toEqual(now);
    expect(w.endsAt.getTime() - now.getTime()).toBe(30 * DAY);
  });

  it("stacks a renewal after the latest active end date", () => {
    const end1 = new Date(now.getTime() + 5 * DAY);
    const end2 = new Date(now.getTime() + 12 * DAY);
    const w = computeSubscriptionWindow(now, [end1, end2, new Date(now.getTime() - DAY)], 30);
    expect(w.startsAt).toEqual(end2);
    expect(w.endsAt).toEqual(new Date(end2.getTime() + 30 * DAY));
  });

  it("detects expiry and extends from the later of now/end", () => {
    expect(shouldExpire({ status: "ACTIVE", endsAt: new Date(now.getTime() - 1) }, now)).toBe(true);
    expect(shouldExpire({ status: "ACTIVE", endsAt: new Date(now.getTime() + 1) }, now)).toBe(false);
    expect(shouldExpire({ status: "CANCELLED", endsAt: new Date(now.getTime() - 1) }, now)).toBe(false);
    expect(extendEndDate(new Date(now.getTime() - 10 * DAY), now, 5)).toEqual(new Date(now.getTime() + 5 * DAY));
    expect(extendEndDate(new Date(now.getTime() + 10 * DAY), now, 5)).toEqual(new Date(now.getTime() + 15 * DAY));
  });

  it("freezes plan terms into a valid snapshot", () => {
    const snap = planToSnapshot({ name: "p", price: 100, durationDays: 30, maxRequestsPerPeriod: null, maxOffersPerPeriod: 5 });
    expect(parsePlanSnapshot(snap)).toEqual(snap);
  });

  it("validates plan input (empty limit = unlimited)", () => {
    const r = planInputSchema.safeParse({
      name: "حرفه‌ای", slug: "pro", price: "690,000", durationDays: "30", maxRequestsPerPeriod: "", maxOffersPerPeriod: "60",
      features: "الف\n\nب", isActive: true, sortOrder: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.price).toBe(690000);
      expect(r.data.maxRequestsPerPeriod).toBeNull();
      expect(r.data.maxOffersPerPeriod).toBe(60);
      expect(r.data.features).toEqual(["الف", "ب"]);
    }
    expect(planInputSchema.safeParse({ name: "x", slug: "Bad Slug", price: "1", durationDays: "0", isActive: true }).success).toBe(false);
  });
});

describe("simulated payments & wallet", () => {
  const payment = { userId: "u1", status: "PENDING" as const, gateway: "SIMULATED" as const };

  it("only the owner can settle a pending simulated payment, once", () => {
    expect(canCompleteSimulatedPayment(payment, "u1")).toBeNull();
    expect(canCompleteSimulatedPayment(payment, "u2")).toBe("NOT_OWNER");
    expect(canCompleteSimulatedPayment({ ...payment, status: "SUCCEEDED" }, "u1")).toBe("NOT_PENDING");
    expect(canCompleteSimulatedPayment({ ...payment, status: "FAILED" }, "u1")).toBe("NOT_PENDING");
    expect(canCompleteSimulatedPayment({ ...payment, gateway: "WALLET" }, "u1")).toBe("WRONG_GATEWAY");
  });

  it("never lets the wallet go negative", () => {
    expect(walletBalanceAfterDebit(1000, 400)).toBe(600);
    expect(() => walletBalanceAfterDebit(300, 400)).toThrow("INSUFFICIENT_BALANCE");
    expect(() => walletBalanceAfterDebit(300, -5)).toThrow("INVALID_AMOUNT");
    expect(() => walletBalanceAfterDebit(300, 1.5)).toThrow("INVALID_AMOUNT");
    expect(walletBalanceAfterCredit(100, 50)).toBe(150);
    expect(() => walletBalanceAfterCredit(100, 0)).toThrow("INVALID_AMOUNT");
  });

  it("validates top-up amounts", () => {
    expect(topUpSchema.safeParse({ amount: "500,000" }).success).toBe(true);
    expect(topUpSchema.safeParse({ amount: "5000" }).success).toBe(false);
    expect(topUpSchema.safeParse({ amount: "999999999" }).success).toBe(false);
    expect(topUpSchema.safeParse({ amount: "abc" }).success).toBe(false);
  });

  it("marks tracking codes as simulated", () => {
    expect(simulatedTrackingCode(() => 0.5)).toBe("SIM-5555555555");
  });
});

describe("provider verification", () => {
  const complete = { displayName: "x", bio: "ب".repeat(30), servicesCount: 1, areasCount: 1, documentsCount: 1 };

  it("requires a complete profile to submit", () => {
    expect(verificationChecklist(complete).every((i) => i.done)).toBe(true);
    expect(canSubmitForVerification("DRAFT", complete)).toBeNull();
    expect(canSubmitForVerification("REJECTED", complete)).toBeNull();
    expect(canSubmitForVerification("DRAFT", { ...complete, documentsCount: 0 })).toBe("INCOMPLETE");
    expect(canSubmitForVerification("DRAFT", { ...complete, bio: "کوتاه" })).toBe("INCOMPLETE");
    expect(canSubmitForVerification("PENDING", complete)).toBe("INVALID_STATE");
    expect(canSubmitForVerification("APPROVED", complete)).toBe("INVALID_STATE");
  });

  it("lets admins review only pending profiles and requires a rejection reason", () => {
    expect(canReview("PENDING", "APPROVE")).toBeNull();
    expect(canReview("PENDING", "REJECT", "مدارک ناخوانا")).toBeNull();
    expect(canReview("PENDING", "REJECT", "  ")).toBe("REASON_REQUIRED");
    expect(canReview("DRAFT", "APPROVE")).toBe("NOT_PENDING");
  });
});

describe("featured providers ordering", () => {
  const prov = (id: string, rating: number, count = 1, done = 0) => ({ id, ratingAverage: rating, ratingCount: count, completedOrdersCount: done });
  const live = (providerId: string, sortOrder: number, placement: FeaturedEntry["placement"] = "HOME"): FeaturedEntry => ({
    providerId, placement, isActive: true, startsAt: new Date(now.getTime() - DAY), endsAt: new Date(now.getTime() + DAY), sortOrder,
  });

  it("puts live featured providers first by sortOrder, then by rating", () => {
    const list = [prov("a", 4.9), prov("b", 3), prov("c", 4.5), prov("d", 5)];
    const featured = [live("b", 2), live("c", 1), { ...live("d", 0), isActive: false }, live("a", 0, "SEARCH")];
    expect(orderProviders(list, featured, "HOME", now).map((p) => [p.id, p.isFeatured])).toEqual([
      ["c", true],
      ["b", true],
      ["d", false],
      ["a", false],
    ]);
  });

  it("ignores expired or future entries", () => {
    expect(isFeaturedLive({ isActive: true, startsAt: new Date(now.getTime() + DAY), endsAt: new Date(now.getTime() + 2 * DAY) }, now)).toBe(false);
    expect(isFeaturedLive({ isActive: true, startsAt: new Date(now.getTime() - 2 * DAY), endsAt: new Date(now.getTime() - DAY) }, now)).toBe(false);
  });

  it("validates featured input dates", () => {
    const base = { providerId: "0b1c2d3e-0000-4000-8000-123456789abc", placement: "HOME", startsAt: "2026-11-01", endsAt: "2026-12-01", price: "", sortOrder: "", isActive: true };
    expect(featuredInputSchema.safeParse(base).success).toBe(true);
    expect(featuredInputSchema.safeParse({ ...base, endsAt: "2026-10-01" }).success).toBe(false);
    expect(featuredInputSchema.safeParse({ ...base, placement: "TOP" }).success).toBe(false);
  });
});

describe("support tickets", () => {
  it("updates status depending on who replied", () => {
    expect(statusAfterMessage("OPEN", true)).toBe("ANSWERED");
    expect(statusAfterMessage("ANSWERED", false)).toBe("CUSTOMER_REPLY");
    expect(statusAfterMessage("CLOSED", false)).toBe("CUSTOMER_REPLY");
    expect(statusAfterMessage("OPEN", false)).toBe("OPEN");
  });

  it("validates new tickets", () => {
    expect(ticketCreateSchema.safeParse({ subject: "مشکل در پرداخت", category: "PAYMENT", message: "پرداخت من انجام نشد لطفاً بررسی کنید", orderId: "" }).success).toBe(true);
    expect(ticketCreateSchema.safeParse({ subject: "کم", category: "PAYMENT", message: "x" }).success).toBe(false);
    expect(ticketCreateSchema.safeParse({ subject: "عنوان معتبر", category: "SPAM", message: "متن به اندازه کافی طولانی" }).success).toBe(false);
  });
});

describe("addresses", () => {
  it("validates address input", () => {
    const ok = { title: "خانه", cityId: "0b1c2d3e-0000-4000-8000-123456789abc", line: "تهران، خیابان ولیعصر، پلاک ۱۰", postalCode: "", isDefault: false };
    expect(addressInputSchema.safeParse(ok).success).toBe(true);
    expect(addressInputSchema.safeParse({ ...ok, postalCode: "123" }).success).toBe(false);
    expect(addressInputSchema.safeParse({ ...ok, line: "کوتاه" }).success).toBe(false);
  });
});

describe("report aggregation", () => {
  it("buckets by UTC day with zero-fill", () => {
    const rows = [{ d: new Date("2026-11-15T01:00:00Z"), v: 5 }, { d: new Date("2026-11-13T23:00:00Z"), v: 2 }, { d: new Date("2026-10-01T00:00:00Z"), v: 9 }];
    expect(bucketByDay(rows, (r) => r.d, 3, now, (r) => r.v)).toEqual([
      { date: "2026-11-13", value: 2 },
      { date: "2026-11-14", value: 0 },
      { date: "2026-11-15", value: 5 },
    ]);
  });

  it("buckets by month", () => {
    const rows = [{ d: new Date("2026-11-02T00:00:00Z") }, { d: new Date("2026-09-20T00:00:00Z") }, { d: new Date("2026-09-21T00:00:00Z") }];
    expect(bucketByMonth(rows, (r) => r.d, 3, now)).toEqual([
      { month: "2026-09", value: 2 },
      { month: "2026-10", value: 0 },
      { month: "2026-11", value: 1 },
    ]);
  });
});

describe("privacy helpers", () => {
  it("masks public reviewer names", () => {
    expect(maskName("سارا محمدی")).toBe("سارا م.");
    expect(maskName("علی")).toBe("علی");
  });
});
