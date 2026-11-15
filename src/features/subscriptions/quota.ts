import { z } from "zod";

/**
 * Plan terms frozen on a Subscription at purchase time (Subscription.planSnapshot).
 * Quotas apply to the whole subscription period. `null` means unlimited.
 */
export const planSnapshotSchema = z.object({
  name: z.string(),
  price: z.number(),
  durationDays: z.number(),
  maxRequestsPerPeriod: z.number().int().nullable(),
  maxOffersPerPeriod: z.number().int().nullable(),
});
export type PlanSnapshot = z.infer<typeof planSnapshotSchema>;

export function parsePlanSnapshot(raw: unknown): PlanSnapshot | null {
  const parsed = planSnapshotSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export type SubscriptionUsage = {
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  startsAt: Date | null;
  endsAt: Date | null;
  requestsReceived: number;
  offersSubmitted: number;
  planSnapshot: unknown;
};

/** A subscription is usable only while ACTIVE and inside its date window. */
export function isSubscriptionActive(sub: Pick<SubscriptionUsage, "status" | "startsAt" | "endsAt">, now: Date): boolean {
  if (sub.status !== "ACTIVE" || !sub.endsAt) return false;
  if (sub.startsAt && sub.startsAt > now) return false;
  return sub.endsAt > now;
}

/** Remaining quota; Infinity when unlimited, 0 when the snapshot is unreadable (fail closed). */
export function remainingRequests(sub: Pick<SubscriptionUsage, "planSnapshot" | "requestsReceived">): number {
  const plan = parsePlanSnapshot(sub.planSnapshot);
  if (!plan) return 0;
  if (plan.maxRequestsPerPeriod === null) return Infinity;
  return Math.max(0, plan.maxRequestsPerPeriod - sub.requestsReceived);
}

export function remainingOffers(sub: Pick<SubscriptionUsage, "planSnapshot" | "offersSubmitted">): number {
  const plan = parsePlanSnapshot(sub.planSnapshot);
  if (!plan) return 0;
  if (plan.maxOffersPerPeriod === null) return Infinity;
  return Math.max(0, plan.maxOffersPerPeriod - sub.offersSubmitted);
}

export function canReceiveRequest(sub: SubscriptionUsage, now: Date): boolean {
  return isSubscriptionActive(sub, now) && remainingRequests(sub) > 0;
}

export function canSubmitOffer(sub: SubscriptionUsage, now: Date): boolean {
  return isSubscriptionActive(sub, now) && remainingOffers(sub) > 0;
}
