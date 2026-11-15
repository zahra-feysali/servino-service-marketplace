import { z } from "zod";
import type { PlanSnapshot } from "./quota";

/** Pure subscription lifecycle rules (no I/O). */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Window for a newly paid subscription. If the provider already has active subscriptions,
 * the new one starts when the latest of them ends (renewal stacking), otherwise now.
 */
export function computeSubscriptionWindow(now: Date, activeEndDates: Date[], durationDays: number): { startsAt: Date; endsAt: Date } {
  const latestEnd = activeEndDates.filter((d) => d > now).sort((a, b) => b.getTime() - a.getTime())[0];
  const startsAt = latestEnd ?? now;
  return { startsAt, endsAt: new Date(startsAt.getTime() + durationDays * DAY_MS) };
}

/** An ACTIVE subscription whose end date has passed must become EXPIRED. */
export function shouldExpire(sub: { status: string; endsAt: Date | null }, now: Date): boolean {
  return sub.status === "ACTIVE" && !!sub.endsAt && sub.endsAt <= now;
}

export function extendEndDate(current: Date, now: Date, days: number): Date {
  const base = current > now ? current : now;
  return new Date(base.getTime() + days * DAY_MS);
}

export function planToSnapshot(plan: {
  name: string;
  price: number;
  durationDays: number;
  maxRequestsPerPeriod: number | null;
  maxOffersPerPeriod: number | null;
}): PlanSnapshot {
  return {
    name: plan.name,
    price: plan.price,
    durationDays: plan.durationDays,
    maxRequestsPerPeriod: plan.maxRequestsPerPeriod,
    maxOffersPerPeriod: plan.maxOffersPerPeriod,
  };
}

const optionalLimit = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : typeof v === "string" ? Number(v) : v),
  z.number().int("عدد صحیح وارد کنید.").min(1, "حداقل ۱").max(100_000).nullable(),
);

/** Admin input for subscription plans. Empty limit = unlimited. */
export const planInputSchema = z.object({
  name: z.string().trim().min(2, "نام پلن الزامی است.").max(100),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "نامک فقط شامل حروف کوچک انگلیسی، عدد و خط تیره باشد."),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
  price: z.preprocess((v) => (typeof v === "string" ? Number(v.replace(/[,\s٬]/g, "")) : v), z.number().int().min(0, "قیمت نامعتبر است.").max(1_000_000_000)),
  durationDays: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().int().min(1, "حداقل ۱ روز").max(730)),
  maxRequestsPerPeriod: optionalLimit,
  maxOffersPerPeriod: optionalLimit,
  features: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20),
    ),
  isActive: z.boolean(),
  sortOrder: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().int().min(0).max(10_000)),
});
export type PlanInput = z.input<typeof planInputSchema>;

export const SUBSCRIPTION_STATUS_META = {
  PENDING: { label: "در انتظار پرداخت", variant: "outline" },
  ACTIVE: { label: "فعال", variant: "default" },
  EXPIRED: { label: "منقضی‌شده", variant: "secondary" },
  CANCELLED: { label: "لغوشده", variant: "destructive" },
} as const;
