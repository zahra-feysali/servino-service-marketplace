import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError, isUniqueConstraintError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { consumeOfferQuota } from "@/features/matching/service";
import { notify } from "@/features/notifications/service";
import { requireApprovedProvider } from "@/features/providers/service";
import { formatPrice } from "@/lib/utils";
import {
  SELECTION_ERROR_MESSAGES,
  isRequestOpenForOffers,
  validateSelection,
  type OfferInputData,
} from "./rules";

/**
 * Provider submits a price offer (spec §6 step 4).
 * Requirements: approved provider, matched to the request, request OPEN and not expired,
 * one offer per provider per request, and remaining offer quota on an active subscription.
 * The request row is locked so submissions serialize with offer selection.
 */
export async function submitOffer(providerUserId: string, requestId: string, input: OfferInputData) {
  try {
    return await prisma.$transaction(async (tx) => {
      const provider = await requireApprovedProvider(providerUserId, tx);
      if (!(await lockRow(tx, "ServiceRequest", requestId))) throw new NotFoundError("درخواست یافت نشد.");

      const request = await tx.serviceRequest.findUniqueOrThrow({
        where: { id: requestId },
        select: { id: true, code: true, status: true, expiresAt: true, customerId: true, service: { select: { name: true } } },
      });
      const match = await tx.requestMatch.findUnique({
        where: { requestId_providerId: { requestId, providerId: provider.id } },
        select: { id: true },
      });
      if (!match) throw new ForbiddenError("این درخواست برای شما ارسال نشده است.");
      if (!isRequestOpenForOffers(request, new Date())) {
        throw new AppError("این درخواست دیگر پیشنهاد جدید نمی‌پذیرد.", "REQUEST_NOT_OPEN");
      }

      const existing = await tx.providerOffer.findUnique({
        where: { requestId_providerId: { requestId, providerId: provider.id } },
        select: { id: true },
      });
      if (existing) throw new AppError("شما قبلاً برای این درخواست پیشنهاد ثبت کرده‌اید.", "DUPLICATE_OFFER");

      const subscriptionId = await consumeOfferQuota(tx, providerUserId);
      if (!subscriptionId) {
        throw new AppError("اشتراک فعال یا سهمیه ارسال پیشنهاد ندارید.", "NO_OFFER_QUOTA");
      }

      const offer = await tx.providerOffer.create({
        data: {
          requestId,
          providerId: provider.id,
          price: input.price,
          estimatedDuration: input.estimatedDuration,
          estimatedDurationUnit: input.estimatedDurationUnit,
          description: input.description,
          notes: input.notes || null,
          status: "PENDING",
        },
        select: { id: true },
      });
      await tx.serviceRequest.update({ where: { id: requestId }, data: { offerCount: { increment: 1 } } });

      await notify(tx, [
        {
          userId: request.customerId,
          type: "NEW_OFFER",
          title: `پیشنهاد جدید برای درخواست ${request.code}`,
          body: `${provider.displayName} برای «${request.service.name}» مبلغ ${formatPrice(input.price)} پیشنهاد داد.`,
          link: `/dashboard/customer/requests/${requestId}`,
        },
      ]);
      return offer;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError("شما قبلاً برای این درخواست پیشنهاد ثبت کرده‌اید.", "DUPLICATE_OFFER");
    }
    throw error;
  }
}

/** Provider withdraws their own PENDING offer while the request is still OPEN. (Used quota is not refunded.) */
export async function withdrawOffer(providerUserId: string, offerId: string) {
  await prisma.$transaction(async (tx) => {
    const provider = await requireApprovedProvider(providerUserId, tx);
    const offer = await tx.providerOffer.findUnique({ where: { id: offerId }, select: { requestId: true, providerId: true } });
    if (!offer || offer.providerId !== provider.id) throw new NotFoundError("پیشنهاد یافت نشد.");

    await lockRow(tx, "ServiceRequest", offer.requestId);
    const current = await tx.providerOffer.findUniqueOrThrow({
      where: { id: offerId },
      select: { status: true, request: { select: { status: true, code: true, customerId: true } } },
    });
    if (current.status !== "PENDING" || current.request.status !== "OPEN") {
      throw new AppError("این پیشنهاد دیگر قابل انصراف نیست.", "INVALID_STATE");
    }
    await tx.providerOffer.update({ where: { id: offerId }, data: { status: "WITHDRAWN" } });
    await tx.serviceRequest.update({ where: { id: offer.requestId }, data: { offerCount: { decrement: 1 } } });
    await notify(tx, [
      {
        userId: current.request.customerId,
        type: "SYSTEM",
        title: `یک پیشنهاد برای درخواست ${current.request.code} پس گرفته شد`,
        link: `/dashboard/customer/requests/${offer.requestId}`,
      },
    ]);
  });
}

/**
 * Customer selects an offer (spec §6 step 5) — ONE transaction:
 *  lock request row → verify ownership/state/offer → accept offer (guarded update) →
 *  reject other pending offers → update request → create order → status history → notifications.
 * Concurrency: the row lock serializes competing selections/offers; `Order.requestId` and
 * `Order.offerId` are UNIQUE, so even a bypassed lock cannot create a second order.
 */
export async function selectOffer(customerId: string, requestId: string, offerId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      if (!(await lockRow(tx, "ServiceRequest", requestId))) throw new NotFoundError("درخواست یافت نشد.");
      const request = await tx.serviceRequest.findUniqueOrThrow({
        where: { id: requestId },
        select: { id: true, code: true, customerId: true, status: true, expiresAt: true, serviceId: true, service: { select: { name: true } } },
      });
      const offer = await tx.providerOffer.findUnique({
        where: { id: offerId },
        select: {
          id: true, requestId: true, status: true, price: true, providerId: true,
          provider: { select: { userId: true, displayName: true, verificationStatus: true, user: { select: { status: true } } } },
        },
      });

      const error = validateSelection({ customerId, request, offer, now: new Date() });
      if (error === "NOT_OWNER") throw new ForbiddenError(SELECTION_ERROR_MESSAGES.NOT_OWNER);
      if (error) throw new AppError(SELECTION_ERROR_MESSAGES[error], error);
      const accepted = offer!;
      // A provider who was suspended or lost approval after offering cannot be selected
      // (otherwise the order would reveal the customer's address/phone to them).
      if (accepted.provider.verificationStatus !== "APPROVED" || accepted.provider.user.status !== "ACTIVE") {
        throw new AppError("این متخصص در حال حاضر امکان پذیرش سفارش ندارد.", "PROVIDER_UNAVAILABLE");
      }

      // Guarded state change: only succeeds if the offer is still PENDING.
      const acceptedCount = await tx.providerOffer.updateMany({
        where: { id: accepted.id, requestId, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });
      if (acceptedCount.count !== 1) throw new AppError(SELECTION_ERROR_MESSAGES.OFFER_NOT_PENDING, "OFFER_NOT_PENDING");

      const rejected = await tx.providerOffer.findMany({
        where: { requestId, status: "PENDING", id: { not: accepted.id } },
        select: { provider: { select: { userId: true } } },
      });
      await tx.providerOffer.updateMany({
        where: { requestId, status: "PENDING", id: { not: accepted.id } },
        data: { status: "REJECTED" },
      });

      await tx.serviceRequest.update({ where: { id: requestId }, data: { status: "PROVIDER_SELECTED" } });
      await tx.requestStatusHistory.create({
        data: {
          requestId,
          fromStatus: "OPEN",
          toStatus: "PROVIDER_SELECTED",
          changedById: customerId,
          note: `انتخاب پیشنهاد ${accepted.provider.displayName}`,
        },
      });

      const order = await tx.order.create({
        data: {
          requestId,
          offerId: accepted.id,
          customerId,
          providerId: accepted.providerId,
          serviceId: request.serviceId,
          price: accepted.price, // from the stored offer — never from client input
          status: "PENDING_PROVIDER_CONFIRMATION",
        },
        select: { id: true, code: true },
      });
      await tx.orderStatusHistory.create({
        data: { orderId: order.id, fromStatus: null, toStatus: "PENDING_PROVIDER_CONFIRMATION", changedById: customerId, note: "ایجاد سفارش" },
      });

      await notify(tx, [
        {
          userId: accepted.provider.userId,
          type: "OFFER_ACCEPTED",
          title: `پیشنهاد شما برای درخواست ${request.code} پذیرفته شد`,
          body: `سفارش شماره ${order.code} ایجاد شد. لطفاً آن را تأیید کنید.`,
          link: `/dashboard/provider/orders/${order.id}`,
        },
        {
          userId: customerId,
          type: "ORDER_CREATED",
          title: `سفارش ${order.code} ایجاد شد`,
          body: `«${request.service.name}» با ${accepted.provider.displayName} — در انتظار تأیید متخصص.`,
          link: `/dashboard/customer/orders/${order.id}`,
        },
        ...rejected.map((r) => ({
          userId: r.provider.userId,
          type: "OFFER_REJECTED" as const,
          title: `پیشنهاد شما برای درخواست ${request.code} انتخاب نشد`,
          link: "/dashboard/provider/offers",
        })),
      ]);

      return order;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError("برای این درخواست قبلاً متخصص انتخاب شده است.", "ALREADY_SELECTED");
    }
    throw error;
  }
}

export async function listProviderOffers(providerId: string) {
  return prisma.providerOffer.findMany({
    where: { providerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      price: true,
      estimatedDuration: true,
      estimatedDurationUnit: true,
      status: true,
      createdAt: true,
      request: { select: { id: true, code: true, status: true, service: { select: { name: true } }, city: { select: { name: true } } } },
      order: { select: { id: true, code: true, status: true } },
    },
  });
}
