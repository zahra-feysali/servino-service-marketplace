import { z } from "zod";

/** Pure rules for offers and offer selection. */

export function isRequestExpired(request: { expiresAt: Date | null }, now: Date): boolean {
  return !!request.expiresAt && request.expiresAt <= now;
}

/** A request accepts new offers only while OPEN and not past its expiry. */
export function isRequestOpenForOffers(request: { status: string; expiresAt: Date | null }, now: Date): boolean {
  return request.status === "OPEN" && !isRequestExpired(request, now);
}

export type SelectionError =
  | "NOT_OWNER"
  | "REQUEST_NOT_OPEN"
  | "OFFER_NOT_FOUND"
  | "OFFER_WRONG_REQUEST"
  | "OFFER_NOT_PENDING";

/**
 * Validates an offer selection (spec §6 step 5, checks 1–4). The service runs this
 * *after* locking the request row inside the transaction.
 */
export function validateSelection(params: {
  customerId: string;
  request: { id: string; customerId: string; status: string; expiresAt: Date | null };
  offer: { id: string; requestId: string; status: string } | null;
  now: Date;
}): SelectionError | null {
  const { customerId, request, offer, now } = params;
  if (request.customerId !== customerId) return "NOT_OWNER";
  if (!isRequestOpenForOffers(request, now)) return "REQUEST_NOT_OPEN";
  if (!offer) return "OFFER_NOT_FOUND";
  if (offer.requestId !== request.id) return "OFFER_WRONG_REQUEST";
  if (offer.status !== "PENDING") return "OFFER_NOT_PENDING";
  return null;
}

export const SELECTION_ERROR_MESSAGES: Record<SelectionError, string> = {
  NOT_OWNER: "این درخواست متعلق به شما نیست.",
  REQUEST_NOT_OPEN: "این درخواست دیگر امکان انتخاب پیشنهاد ندارد.",
  OFFER_NOT_FOUND: "پیشنهاد مورد نظر یافت نشد.",
  OFFER_WRONG_REQUEST: "این پیشنهاد مربوط به این درخواست نیست.",
  OFFER_NOT_PENDING: "این پیشنهاد دیگر قابل انتخاب نیست.",
};

export const offerInputSchema = z.object({
  price: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[,\s٬]/g, "")) : v),
    z
      .number({ error: "قیمت پیشنهادی را وارد کنید." })
      .int("قیمت باید عدد صحیح (تومان) باشد.")
      .min(10_000, "حداقل قیمت ۱۰٬۰۰۰ تومان است.")
      .max(2_000_000_000, "قیمت وارد شده بیش از حد مجاز است."),
  ),
  estimatedDuration: z.preprocess(
    (v) => (typeof v === "string" && v !== "" ? Number(v) : v),
    z.number({ error: "زمان تقریبی انجام کار را وارد کنید." }).int().min(1, "حداقل ۱").max(365, "حداکثر ۳۶۵"),
  ),
  estimatedDurationUnit: z.enum(["HOUR", "DAY"]),
  description: z.string().trim().min(10, "توضیحات پیشنهاد حداقل ۱۰ کاراکتر باشد.").max(2000),
  notes: z.string().trim().max(1000).optional(),
});
export type OfferInput = z.input<typeof offerInputSchema>;
export type OfferInputData = z.output<typeof offerInputSchema>;

/** Duration in hours for comparing offers (1 day = 24h). */
export function durationInHours(offer: { estimatedDuration: number; estimatedDurationUnit: "HOUR" | "DAY" }): number {
  return offer.estimatedDurationUnit === "DAY" ? offer.estimatedDuration * 24 : offer.estimatedDuration;
}

export type ComparableOffer = {
  id: string;
  price: number;
  estimatedDuration: number;
  estimatedDurationUnit: "HOUR" | "DAY";
  ratingAverage: number;
  ratingCount: number;
};

export type OfferSort = "price" | "duration" | "rating";

export function sortOffers<T extends ComparableOffer>(offers: T[], sort: OfferSort): T[] {
  const copy = [...offers];
  switch (sort) {
    case "price":
      return copy.sort((a, b) => a.price - b.price);
    case "duration":
      return copy.sort((a, b) => durationInHours(a) - durationInHours(b));
    case "rating":
      return copy.sort((a, b) => b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount);
  }
}

/** Highlights for the comparison table: cheapest, fastest and best-rated offer ids. */
export function offerHighlights(offers: ComparableOffer[]) {
  if (offers.length === 0) return { cheapest: null, fastest: null, bestRated: null };
  const cheapest = sortOffers(offers, "price")[0].id;
  const fastest = sortOffers(offers, "duration")[0].id;
  const rated = offers.filter((o) => o.ratingCount > 0);
  const bestRated = rated.length ? sortOffers(rated, "rating")[0].id : null;
  return { cheapest, fastest, bestRated };
}
