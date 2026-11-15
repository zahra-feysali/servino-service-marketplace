import { canReceiveRequest, isSubscriptionActive, type SubscriptionUsage } from "@/features/subscriptions/quota";

/**
 * Provider matching rules (pure). A provider is eligible for a request only if ALL hold:
 * approved profile, active (not suspended/inactive) account, offers the requested service,
 * serves the request's city, and has an active subscription with remaining request quota.
 */

export type MatchCandidate = {
  providerId: string;
  userId: string;
  userStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  verificationStatus: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  serviceIds: string[];
  cityIds: string[];
  subscriptions: (SubscriptionUsage & { id: string })[];
};

export type MatchTarget = { serviceId: string; cityId: string };

export type IneligibilityReason =
  | "NOT_APPROVED"
  | "ACCOUNT_NOT_ACTIVE"
  | "SERVICE_NOT_OFFERED"
  | "CITY_NOT_SERVED"
  | "NO_ACTIVE_SUBSCRIPTION"
  | "QUOTA_EXHAUSTED";

export type EligibilityResult =
  | { eligible: true; subscriptionId: string }
  | { eligible: false; reasons: IneligibilityReason[] };

/**
 * Chooses which subscription pays for receiving the request: among usable subscriptions,
 * the one that expires first (so quota from soon-to-expire plans is consumed first).
 */
export function pickSubscription(subs: MatchCandidate["subscriptions"], now: Date) {
  return (
    subs
      .filter((s) => canReceiveRequest(s, now))
      .sort((a, b) => (a.endsAt?.getTime() ?? 0) - (b.endsAt?.getTime() ?? 0))[0] ?? null
  );
}

export function evaluateEligibility(candidate: MatchCandidate, target: MatchTarget, now: Date): EligibilityResult {
  const reasons: IneligibilityReason[] = [];
  if (candidate.verificationStatus !== "APPROVED") reasons.push("NOT_APPROVED");
  if (candidate.userStatus !== "ACTIVE") reasons.push("ACCOUNT_NOT_ACTIVE");
  if (!candidate.serviceIds.includes(target.serviceId)) reasons.push("SERVICE_NOT_OFFERED");
  if (!candidate.cityIds.includes(target.cityId)) reasons.push("CITY_NOT_SERVED");

  const usable = pickSubscription(candidate.subscriptions, now);
  if (!usable) {
    const hasActive = candidate.subscriptions.some((s) => isSubscriptionActive(s, now));
    reasons.push(hasActive ? "QUOTA_EXHAUSTED" : "NO_ACTIVE_SUBSCRIPTION");
  }

  if (reasons.length > 0 || !usable) return { eligible: false, reasons };
  return { eligible: true, subscriptionId: usable.id };
}

export function selectEligibleProviders(candidates: MatchCandidate[], target: MatchTarget, now: Date) {
  const result: { providerId: string; userId: string; subscriptionId: string }[] = [];
  for (const c of candidates) {
    const r = evaluateEligibility(c, target, now);
    if (r.eligible) result.push({ providerId: c.providerId, userId: c.userId, subscriptionId: r.subscriptionId });
  }
  return result;
}
