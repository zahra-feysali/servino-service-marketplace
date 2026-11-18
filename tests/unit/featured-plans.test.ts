import { describe, expect, it } from "vitest";
import { featuredPlanSchema, featuredState, purchaseWindow } from "@/features/featured/purchase-rules";

const DAY = 86_400_000;
const now = new Date("2026-11-18T10:00:00Z");

describe("featured plan purchase rules", () => {
  it("starts now, or stacks after a running placement (renewal)", () => {
    expect(purchaseWindow(now, null, 30)).toEqual({ startsAt: now, endsAt: new Date(now.getTime() + 30 * DAY) });
    const runningEnd = new Date(now.getTime() + 5 * DAY);
    expect(purchaseWindow(now, runningEnd, 14)).toEqual({ startsAt: runningEnd, endsAt: new Date(runningEnd.getTime() + 14 * DAY) });
    const pastEnd = new Date(now.getTime() - DAY);
    expect(purchaseWindow(now, pastEnd, 7).startsAt).toEqual(now);
  });

  it("derives a display state including automatic expiry", () => {
    const base = { source: "PURCHASE" as const, isActive: true, paidAt: now, startsAt: new Date(now.getTime() - DAY), endsAt: new Date(now.getTime() + DAY) };
    expect(featuredState(base, "SUCCEEDED", now)).toBe("ACTIVE");
    expect(featuredState({ ...base, startsAt: new Date(now.getTime() + DAY), endsAt: new Date(now.getTime() + 2 * DAY) }, "SUCCEEDED", now)).toBe("SCHEDULED");
    expect(featuredState({ ...base, endsAt: now }, "SUCCEEDED", now)).toBe("EXPIRED");
    expect(featuredState({ ...base, paidAt: null, isActive: false }, "PENDING", now)).toBe("PENDING_PAYMENT");
    expect(featuredState({ ...base, paidAt: null, isActive: false }, "FAILED", now)).toBe("PAYMENT_FAILED");
    expect(featuredState({ ...base, source: "ADMIN", paidAt: null, isActive: false }, null, now)).toBe("INACTIVE");
  });

  it("validates admin plan input", () => {
    const valid = { name: "ویژه", slug: "Home-30", description: "", placement: "HOME", durationDays: "30", price: "450000", sortOrder: "0", isActive: true };
    const r = featuredPlanSchema.safeParse(valid);
    expect(r.success && r.data).toMatchObject({ slug: "home-30", durationDays: 30, price: 450000, description: null });
    expect(featuredPlanSchema.safeParse({ ...valid, durationDays: "0" }).success).toBe(false);
    expect(featuredPlanSchema.safeParse({ ...valid, price: "-1" }).success).toBe(false);
    expect(featuredPlanSchema.safeParse({ ...valid, placement: "TOP" }).success).toBe(false);
  });
});
