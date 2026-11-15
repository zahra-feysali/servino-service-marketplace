import { z } from "zod";

/** Featured placement rules (pure). Featured status is independent of subscription plans. */

export const PLACEMENTS = ["HOME", "CATEGORY", "SEARCH"] as const;
export type Placement = (typeof PLACEMENTS)[number];

export const PLACEMENT_LABELS: Record<Placement, string> = {
  HOME: "صفحه اصلی",
  CATEGORY: "صفحات خدمات",
  SEARCH: "جستجوی متخصصان",
};

export type FeaturedEntry = { providerId: string; placement: Placement; isActive: boolean; startsAt: Date; endsAt: Date; sortOrder: number };

export function isFeaturedLive(f: Pick<FeaturedEntry, "isActive" | "startsAt" | "endsAt">, now: Date): boolean {
  return f.isActive && f.startsAt <= now && f.endsAt > now;
}

/**
 * Backend ordering for provider listings: providers with a live featured entry for the
 * placement come first (by featured sortOrder), then everyone else by rating, review
 * count and completed orders. A provider appears once.
 */
export function orderProviders<T extends { id: string; ratingAverage: number; ratingCount: number; completedOrdersCount: number }>(
  providers: T[],
  featured: FeaturedEntry[],
  placement: Placement,
  now: Date,
): (T & { isFeatured: boolean })[] {
  const rank = new Map<string, number>();
  for (const f of featured) {
    if (f.placement !== placement || !isFeaturedLive(f, now)) continue;
    const prev = rank.get(f.providerId);
    if (prev === undefined || f.sortOrder < prev) rank.set(f.providerId, f.sortOrder);
  }
  return providers
    .map((p) => ({ ...p, isFeatured: rank.has(p.id) }))
    .sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      if (a.isFeatured && b.isFeatured) return rank.get(a.id)! - rank.get(b.id)!;
      return b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount || b.completedOrdersCount - a.completedOrdersCount;
    });
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "تاریخ معتبر نیست.")
  .transform((v) => new Date(`${v}T00:00:00Z`))
  .refine((d) => !Number.isNaN(d.getTime()), "تاریخ معتبر نیست.");

export const featuredInputSchema = z
  .object({
    providerId: z.uuid({ error: "متخصص را انتخاب کنید." }),
    placement: z.enum(PLACEMENTS),
    startsAt: dateSchema,
    endsAt: dateSchema,
    price: z.preprocess((v) => (v === "" || v === undefined ? null : Number(String(v).replace(/[,\s٬]/g, ""))), z.number().int().min(0).max(1_000_000_000).nullable()),
    sortOrder: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().int().min(0).max(10_000)),
    isActive: z.boolean(),
  })
  .refine((f) => f.endsAt > f.startsAt, { path: ["endsAt"], message: "تاریخ پایان باید بعد از تاریخ شروع باشد." });
