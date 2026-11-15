import { describe, expect, it } from "vitest";
import { evaluateEligibility, pickSubscription, selectEligibleProviders, type MatchCandidate } from "@/features/matching/rules";
import { canSubmitOffer, remainingOffers, remainingRequests } from "@/features/subscriptions/quota";

const now = new Date("2026-11-15T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const target = { serviceId: "svc-1", cityId: "city-1" };

const sub = (over: Partial<MatchCandidate["subscriptions"][number]> = {}): MatchCandidate["subscriptions"][number] => ({
  id: "sub-1",
  status: "ACTIVE",
  startsAt: new Date(now.getTime() - day),
  endsAt: new Date(now.getTime() + 10 * day),
  requestsReceived: 0,
  offersSubmitted: 0,
  planSnapshot: { name: "p", price: 1, durationDays: 30, maxRequestsPerPeriod: 5, maxOffersPerPeriod: 3 },
  ...over,
});

const candidate = (over: Partial<MatchCandidate> = {}): MatchCandidate => ({
  providerId: "prov-1",
  userId: "user-1",
  userStatus: "ACTIVE",
  verificationStatus: "APPROVED",
  serviceIds: ["svc-1"],
  cityIds: ["city-1"],
  subscriptions: [sub()],
  ...over,
});

describe("provider matching rules", () => {
  it("accepts a provider satisfying all conditions", () => {
    expect(evaluateEligibility(candidate(), target, now)).toEqual({ eligible: true, subscriptionId: "sub-1" });
  });

  it.each([
    ["NOT_APPROVED", { verificationStatus: "PENDING" as const }],
    ["NOT_APPROVED", { verificationStatus: "REJECTED" as const }],
    ["ACCOUNT_NOT_ACTIVE", { userStatus: "SUSPENDED" as const }],
    ["ACCOUNT_NOT_ACTIVE", { userStatus: "INACTIVE" as const }],
    ["SERVICE_NOT_OFFERED", { serviceIds: ["svc-2"] }],
    ["CITY_NOT_SERVED", { cityIds: ["city-2"] }],
    ["NO_ACTIVE_SUBSCRIPTION", { subscriptions: [] }],
    ["NO_ACTIVE_SUBSCRIPTION", { subscriptions: [sub({ status: "PENDING" })] }],
    ["NO_ACTIVE_SUBSCRIPTION", { subscriptions: [sub({ status: "CANCELLED" })] }],
    ["NO_ACTIVE_SUBSCRIPTION", { subscriptions: [sub({ endsAt: new Date(now.getTime() - 1) })] }],
    ["NO_ACTIVE_SUBSCRIPTION", { subscriptions: [sub({ startsAt: new Date(now.getTime() + day) })] }],
    ["QUOTA_EXHAUSTED", { subscriptions: [sub({ requestsReceived: 5 })] }],
    ["QUOTA_EXHAUSTED", { subscriptions: [sub({ planSnapshot: { broken: true } })] }],
  ])("rejects with %s", (reason, over) => {
    const r = evaluateEligibility(candidate(over), target, now);
    expect(r.eligible).toBe(false);
    if (!r.eligible) expect(r.reasons).toContain(reason);
  });

  it("supports unlimited plans", () => {
    const unlimited = sub({ requestsReceived: 10_000, planSnapshot: { name: "u", price: 1, durationDays: 90, maxRequestsPerPeriod: null, maxOffersPerPeriod: null } });
    expect(evaluateEligibility(candidate({ subscriptions: [unlimited] }), target, now).eligible).toBe(true);
    expect(remainingRequests(unlimited)).toBe(Infinity);
  });

  it("uses the usable subscription that expires first", () => {
    const later = sub({ id: "later", endsAt: new Date(now.getTime() + 20 * day) });
    const sooner = sub({ id: "sooner", endsAt: new Date(now.getTime() + 2 * day) });
    const exhausted = sub({ id: "exhausted", endsAt: new Date(now.getTime() + day), requestsReceived: 5 });
    expect(pickSubscription([later, exhausted, sooner], now)?.id).toBe("sooner");
  });

  it("selects only eligible providers from a candidate list", () => {
    const list = [
      candidate({ providerId: "ok" }),
      candidate({ providerId: "pending", verificationStatus: "PENDING" }),
      candidate({ providerId: "wrong-city", cityIds: ["x"] }),
      candidate({ providerId: "no-quota", subscriptions: [sub({ requestsReceived: 5 })] }),
    ];
    expect(selectEligibleProviders(list, target, now).map((e) => e.providerId)).toEqual(["ok"]);
  });
});

describe("offer quota", () => {
  it("counts remaining offers and blocks when exhausted", () => {
    expect(remainingOffers(sub({ offersSubmitted: 1 }))).toBe(2);
    expect(canSubmitOffer(sub({ offersSubmitted: 3 }), now)).toBe(false);
    expect(canSubmitOffer(sub({ offersSubmitted: 2 }), now)).toBe(true);
    expect(canSubmitOffer(sub({ status: "EXPIRED" }), now)).toBe(false);
  });
});
