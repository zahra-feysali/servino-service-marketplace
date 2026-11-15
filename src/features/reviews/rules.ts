import { z } from "zod";

export const reviewInputSchema = z.object({
  rating: z.preprocess(
    (v) => (typeof v === "string" ? Number(v) : v),
    z.number({ error: "امتیاز را انتخاب کنید." }).int().min(1, "امتیاز بین ۱ تا ۵ است.").max(5, "امتیاز بین ۱ تا ۵ است."),
  ),
  comment: z.string().trim().max(1500, "متن نظر حداکثر ۱۵۰۰ کاراکتر است.").optional(),
});
export type ReviewInput = z.input<typeof reviewInputSchema>;

/** A review may be submitted only by the order's customer, only for COMPLETED orders, and only once. */
export function canReview(params: {
  order: { customerId: string; status: string };
  customerId: string;
  hasExistingReview: boolean;
}): "NOT_OWNER" | "NOT_COMPLETED" | "ALREADY_REVIEWED" | null {
  if (params.order.customerId !== params.customerId) return "NOT_OWNER";
  if (params.order.status !== "COMPLETED") return "NOT_COMPLETED";
  if (params.hasExistingReview) return "ALREADY_REVIEWED";
  return null;
}

/** Rating aggregate from valid (published) reviews, rounded to 2 decimals. */
export function computeRating(ratings: number[]): { average: number; count: number } {
  if (ratings.length === 0) return { average: 0, count: 0 };
  const sum = ratings.reduce((a, b) => a + b, 0);
  return { average: Math.round((sum / ratings.length) * 100) / 100, count: ratings.length };
}
