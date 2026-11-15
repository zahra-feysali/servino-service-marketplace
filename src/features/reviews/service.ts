import { prisma, type TxClient } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError, isUniqueConstraintError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { notify } from "@/features/notifications/service";
import { canReview, computeRating } from "./rules";

/** Recomputes a provider's rating from PUBLISHED reviews only (call inside the changing transaction). */
export async function recomputeProviderRating(tx: TxClient, providerId: string) {
  const reviews = await tx.review.findMany({ where: { providerId, status: "PUBLISHED" }, select: { rating: true } });
  const { average, count } = computeRating(reviews.map((r) => r.rating));
  await tx.providerProfile.update({ where: { id: providerId }, data: { ratingAverage: average, ratingCount: count } });
}

/** Customer reviews a COMPLETED order exactly once (spec §14). */
export async function submitReview(customerId: string, orderId: string, input: { rating: number; comment?: string }) {
  try {
    await prisma.$transaction(async (tx) => {
      if (!(await lockRow(tx, "Order", orderId))) throw new NotFoundError("سفارش یافت نشد.");
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { id: true, code: true, customerId: true, status: true, providerId: true, provider: { select: { userId: true } }, review: { select: { id: true } } },
      });
      const error = canReview({ order, customerId, hasExistingReview: !!order.review });
      if (error === "NOT_OWNER") throw new ForbiddenError();
      if (error === "NOT_COMPLETED") throw new AppError("فقط برای سفارش‌های تکمیل‌شده می‌توان نظر ثبت کرد.", error);
      if (error === "ALREADY_REVIEWED") throw new AppError("برای این سفارش قبلاً نظر ثبت کرده‌اید.", error);

      await tx.review.create({
        data: { orderId, customerId, providerId: order.providerId, rating: input.rating, comment: input.comment || null },
      });
      await recomputeProviderRating(tx, order.providerId);
      await notify(tx, [
        {
          userId: order.provider.userId,
          type: "REVIEW_RECEIVED",
          title: `نظر جدید برای سفارش ${order.code}`,
          body: `امتیاز ${input.rating} از ۵`,
          link: `/dashboard/provider/orders/${orderId}`,
        },
      ]);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new AppError("برای این سفارش قبلاً نظر ثبت کرده‌اید.", "ALREADY_REVIEWED");
    throw error;
  }
}

export async function listCustomerReviews(customerId: string) {
  return prisma.review.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      status: true,
      createdAt: true,
      order: { select: { id: true, code: true, service: { select: { name: true } } } },
      provider: { select: { displayName: true } },
    },
  });
}
