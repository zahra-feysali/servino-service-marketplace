import { describe, expect, it } from "vitest";
import {
  durationInHours,
  isRequestOpenForOffers,
  offerHighlights,
  offerInputSchema,
  sortOffers,
  validateSelection,
} from "@/features/offers/rules";
import { canReview, computeRating, reviewInputSchema } from "@/features/reviews/rules";
import { effectiveRequestStatus } from "@/features/requests/labels";

const now = new Date("2026-11-15T12:00:00Z");
const future = new Date(now.getTime() + 60_000);
const past = new Date(now.getTime() - 60_000);

describe("offer selection validation", () => {
  const request = { id: "r1", customerId: "c1", status: "OPEN", expiresAt: future };
  const offer = { id: "o1", requestId: "r1", status: "PENDING" };

  it("accepts a valid selection", () => {
    expect(validateSelection({ customerId: "c1", request, offer, now })).toBeNull();
  });

  it.each([
    ["NOT_OWNER", { customerId: "intruder" }],
    ["REQUEST_NOT_OPEN", { request: { ...request, status: "PROVIDER_SELECTED" } }],
    ["REQUEST_NOT_OPEN", { request: { ...request, expiresAt: past } }],
    ["OFFER_NOT_FOUND", { offer: null }],
    ["OFFER_WRONG_REQUEST", { offer: { ...offer, requestId: "other" } }],
    ["OFFER_NOT_PENDING", { offer: { ...offer, status: "ACCEPTED" } }],
    ["OFFER_NOT_PENDING", { offer: { ...offer, status: "WITHDRAWN" } }],
  ])("returns %s", (expected, override) => {
    expect(validateSelection({ customerId: "c1", request, offer, now, ...override })).toBe(expected);
  });

  it("checks ownership before anything else", () => {
    expect(validateSelection({ customerId: "x", request: { ...request, status: "CANCELLED" }, offer: null, now })).toBe("NOT_OWNER");
  });
});

describe("request open/expiry", () => {
  it("treats expired OPEN requests as closed for offers and displays them as expired", () => {
    expect(isRequestOpenForOffers({ status: "OPEN", expiresAt: past }, now)).toBe(false);
    expect(isRequestOpenForOffers({ status: "OPEN", expiresAt: null }, now)).toBe(true);
    expect(effectiveRequestStatus({ status: "OPEN", expiresAt: past }, now)).toBe("EXPIRED");
    expect(effectiveRequestStatus({ status: "COMPLETED", expiresAt: past }, now)).toBe("COMPLETED");
  });
});

describe("offer input", () => {
  const valid = { price: "850,000", estimatedDuration: "3", estimatedDurationUnit: "HOUR", description: "تعمیر کامل با گارانتی" };
  it("parses formatted prices and durations", () => {
    const r = offerInputSchema.safeParse(valid);
    expect(r.success && r.data.price).toBe(850000);
    expect(r.success && r.data.estimatedDuration).toBe(3);
  });
  it("rejects invalid prices and short descriptions", () => {
    expect(offerInputSchema.safeParse({ ...valid, price: "-5" }).success).toBe(false);
    expect(offerInputSchema.safeParse({ ...valid, price: "12.5" }).success).toBe(false);
    expect(offerInputSchema.safeParse({ ...valid, description: "کم" }).success).toBe(false);
    expect(offerInputSchema.safeParse({ ...valid, estimatedDurationUnit: "WEEK" }).success).toBe(false);
  });
});

describe("offer comparison", () => {
  const offers = [
    { id: "a", price: 500, estimatedDuration: 2, estimatedDurationUnit: "DAY" as const, ratingAverage: 4.5, ratingCount: 10 },
    { id: "b", price: 300, estimatedDuration: 10, estimatedDurationUnit: "HOUR" as const, ratingAverage: 3, ratingCount: 2 },
    { id: "c", price: 400, estimatedDuration: 5, estimatedDurationUnit: "HOUR" as const, ratingAverage: 0, ratingCount: 0 },
  ];
  it("sorts by price, duration and rating", () => {
    expect(sortOffers(offers, "price").map((o) => o.id)).toEqual(["b", "c", "a"]);
    expect(sortOffers(offers, "duration").map((o) => o.id)).toEqual(["c", "b", "a"]);
    expect(sortOffers(offers, "rating").map((o) => o.id)).toEqual(["a", "b", "c"]);
    expect(durationInHours(offers[0])).toBe(48);
  });
  it("highlights cheapest, fastest and best-rated (ignoring unrated)", () => {
    expect(offerHighlights(offers)).toEqual({ cheapest: "b", fastest: "c", bestRated: "a" });
    expect(offerHighlights([])).toEqual({ cheapest: null, fastest: null, bestRated: null });
  });
});

describe("reviews", () => {
  const order = { customerId: "c1", status: "COMPLETED" };
  it("allows one review by the owner of a completed order", () => {
    expect(canReview({ order, customerId: "c1", hasExistingReview: false })).toBeNull();
    expect(canReview({ order, customerId: "c2", hasExistingReview: false })).toBe("NOT_OWNER");
    expect(canReview({ order: { ...order, status: "PROVIDER_COMPLETED" }, customerId: "c1", hasExistingReview: false })).toBe("NOT_COMPLETED");
    expect(canReview({ order, customerId: "c1", hasExistingReview: true })).toBe("ALREADY_REVIEWED");
  });
  it("validates rating range", () => {
    expect(reviewInputSchema.safeParse({ rating: 0 }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: 6 }).success).toBe(false);
    expect(reviewInputSchema.safeParse({ rating: "5" }).success).toBe(true);
    expect(reviewInputSchema.safeParse({ rating: 4.5 }).success).toBe(false);
  });
  it("computes the rating aggregate", () => {
    expect(computeRating([])).toEqual({ average: 0, count: 0 });
    expect(computeRating([5, 4, 4])).toEqual({ average: 4.33, count: 3 });
  });
});
