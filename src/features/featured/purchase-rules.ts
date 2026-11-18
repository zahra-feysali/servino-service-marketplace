import { z } from "zod";
import { PLACEMENTS } from "./rules";

/** Self-service featured plans (pure rules). */

const DAY = 86_400_000;

/**
 * A new purchase starts now, or right after the provider's latest paid placement of the same
 * kind that is still running (renewals stack instead of overlapping).
 */
export function purchaseWindow(now: Date, latestEnd: Date | null, durationDays: number) {
  const startsAt = latestEnd && latestEnd > now ? latestEnd : now;
  return { startsAt, endsAt: new Date(startsAt.getTime() + durationDays * DAY) };
}

export type FeaturedState = "PENDING_PAYMENT" | "PAYMENT_FAILED" | "SCHEDULED" | "ACTIVE" | "EXPIRED" | "INACTIVE";

export function featuredState(
  f: { source: "ADMIN" | "PURCHASE"; isActive: boolean; paidAt: Date | null; startsAt: Date; endsAt: Date },
  latestPaymentStatus: "PENDING" | "SUCCEEDED" | "FAILED" | null,
  now: Date,
): FeaturedState {
  if (f.source === "PURCHASE" && !f.paidAt) return latestPaymentStatus === "FAILED" ? "PAYMENT_FAILED" : "PENDING_PAYMENT";
  if (f.endsAt <= now) return "EXPIRED";
  if (!f.isActive) return "INACTIVE";
  if (f.startsAt > now) return "SCHEDULED";
  return "ACTIVE";
}

export const FEATURED_STATE_META: Record<FeaturedState, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  PENDING_PAYMENT: { label: "در انتظار پرداخت", variant: "outline" },
  PAYMENT_FAILED: { label: "پرداخت ناموفق", variant: "destructive" },
  SCHEDULED: { label: "در صف (تمدید)", variant: "secondary" },
  ACTIVE: { label: "فعال", variant: "default" },
  EXPIRED: { label: "منقضی‌شده", variant: "outline" },
  INACTIVE: { label: "غیرفعال‌شده توسط مدیر", variant: "outline" },
};

export const featuredPlanSchema = z.object({
  name: z.string().trim().min(2, "نام پلن را وارد کنید.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "نامک فقط حروف کوچک انگلیسی، عدد و خط تیره."),
  description: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v === "" ? null : v)),
  placement: z.enum(PLACEMENTS),
  durationDays: z.coerce.number().int("مدت باید عدد صحیح باشد.").min(1, "حداقل ۱ روز.").max(365, "حداکثر ۳۶۵ روز."),
  price: z.coerce.number().int("قیمت باید عدد صحیح باشد.").min(0).max(1_000_000_000),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean(),
});
export type FeaturedPlanInput = z.infer<typeof featuredPlanSchema>;

/** Purchased placements rank after admin-curated ones (lower sortOrder ranks first). */
export const PURCHASED_SORT_ORDER = 50;
