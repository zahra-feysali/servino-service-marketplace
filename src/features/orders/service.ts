import { prisma } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { notify } from "@/features/notifications/service";
import { applySettlementForOrderStatus } from "@/features/finance/service";
import { requiresPaymentBefore, settlementActionFor } from "@/features/finance/rules";
import type { AppRole } from "@/features/auth/rbac";
import { ORDER_STATUS_META } from "./labels";
import { checkTransition, timestampFieldFor, type OrderStatus } from "./state-machine";

const TRANSITION_ERRORS = {
  INVALID_TRANSITION: "این تغییر وضعیت برای سفارش در وضعیت فعلی مجاز نیست.",
  ACTOR_NOT_ALLOWED: "شما مجاز به انجام این تغییر وضعیت نیستید.",
  NOTE_REQUIRED: "برای این تغییر وضعیت نوشتن توضیح الزامی است.",
} as const;

/**
 * Changes an order's status (spec §6 step 6). Inside one transaction with the order row locked:
 * verifies the actor's relation to the order (ownership), the allowed transition for the
 * actor's role and the *current* status, then writes the change, history, side effects
 * (request status, provider counters) and notifications.
 */
export async function changeOrderStatus(
  actor: { id: string; role: AppRole },
  orderId: string,
  to: OrderStatus,
  note?: string | null,
) {
  await prisma.$transaction(async (tx) => {
    if (!(await lockRow(tx, "Order", orderId))) throw new NotFoundError("سفارش یافت نشد.");
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        status: true,
        customerId: true,
        requestId: true,
        providerId: true,
        paymentStatus: true,
        provider: { select: { userId: true } },
      },
    });

    const isCustomer = actor.role === "CUSTOMER" && order.customerId === actor.id;
    const isProvider = actor.role === "PROVIDER" && order.provider.userId === actor.id;
    const isAdmin = actor.role === "ADMIN";
    if (!isCustomer && !isProvider && !isAdmin) throw new ForbiddenError();

    const check = checkTransition(order.status, to, actor.role, note);
    if (!check.ok) throw new AppError(TRANSITION_ERRORS[check.reason], check.reason);
    // Escrow: the provider may only start (and the order may only complete) once the customer has paid.
    if (requiresPaymentBefore(to) && order.paymentStatus !== "PAID") {
      throw new AppError("ابتدا مشتری باید هزینه سفارش را پرداخت کند (کیف پول یا درگاه).", "PAYMENT_REQUIRED");
    }

    const now = new Date();
    const stamp = timestampFieldFor(to);
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: {
        status: to,
        ...(stamp ? { [stamp]: now } : {}),
        ...(to === "CANCELLED" ? { cancelledById: actor.id, cancelReason: note?.trim() || null } : {}),
      },
    });
    if (updated.count !== 1) throw new AppError("وضعیت سفارش هم‌زمان تغییر کرده است. صفحه را تازه کنید.", "CONFLICT");

    await tx.orderStatusHistory.create({
      data: { orderId, fromStatus: order.status, toStatus: to, changedById: actor.id, note: note?.trim() || null },
    });

    if (to === "COMPLETED") {
      await tx.serviceRequest.update({ where: { id: order.requestId }, data: { status: "COMPLETED" } });
      await tx.requestStatusHistory.create({
        data: { requestId: order.requestId, fromStatus: "PROVIDER_SELECTED", toStatus: "COMPLETED", changedById: actor.id, note: `تکمیل سفارش ${order.code}` },
      });
      await tx.providerProfile.update({ where: { id: order.providerId }, data: { completedOrdersCount: { increment: 1 } } });
    }
    if (to === "CANCELLED") {
      await tx.serviceRequest.update({ where: { id: order.requestId }, data: { status: "CANCELLED" } });
      await tx.requestStatusHistory.create({
        data: { requestId: order.requestId, fromStatus: "PROVIDER_SELECTED", toStatus: "CANCELLED", changedById: actor.id, note: `لغو سفارش ${order.code}` },
      });
    }

    // Escrow side effects in the same transaction: release provider share or refund the customer.
    const settlementAction = settlementActionFor(to);
    if (settlementAction) await applySettlementForOrderStatus(tx, orderId, to as "COMPLETED" | "CANCELLED", note);

    const label = ORDER_STATUS_META[to].label;
    const recipients = [
      { userId: order.customerId, link: `/dashboard/customer/orders/${orderId}` },
      { userId: order.provider.userId, link: `/dashboard/provider/orders/${orderId}` },
    ].filter((r) => r.userId !== actor.id);
    await notify(
      tx,
      recipients.map((r) => ({
        userId: r.userId,
        type: "ORDER_STATUS_CHANGED" as const,
        title: `وضعیت سفارش ${order.code}: ${label}`,
        body: note?.trim() || undefined,
        link: r.link,
      })),
    );
  });
}

const orderListSelect = {
  id: true,
  code: true,
  status: true,
  price: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { name: true } },
  request: { select: { code: true, city: { select: { name: true } } } },
  provider: { select: { displayName: true } },
  customer: { select: { fullName: true } },
  review: { select: { id: true } },
  paymentStatus: true,
} as const;

export async function listCustomerOrders(customerId: string) {
  return prisma.order.findMany({ where: { customerId }, orderBy: { createdAt: "desc" }, take: 100, select: orderListSelect });
}

export async function listProviderOrders(providerId: string) {
  return prisma.order.findMany({ where: { providerId }, orderBy: { createdAt: "desc" }, take: 100, select: orderListSelect });
}

/** Order detail scoped to the viewer: customer (own orders) or provider (orders assigned to them). */
export async function getOrderDetail(
  viewer: { kind: "customer"; customerId: string } | { kind: "provider"; providerId: string } | { kind: "admin" },
  orderId: string,
) {
  const scope =
    viewer.kind === "customer" ? { customerId: viewer.customerId } : viewer.kind === "provider" ? { providerId: viewer.providerId } : {};
  return prisma.order.findFirst({
    where: { id: orderId, ...scope },
    select: {
      id: true,
      code: true,
      status: true,
      price: true,
      createdAt: true,
      providerConfirmedAt: true,
      startedAt: true,
      providerCompletedAt: true,
      completedAt: true,
      cancelledAt: true,
      cancelReason: true,
      service: { select: { name: true } },
      offer: { select: { estimatedDuration: true, estimatedDurationUnit: true, description: true, notes: true } },
      request: {
        select: {
          id: true,
          code: true,
          addressText: true,
          preferredDate: true,
          description: true,
          city: { select: { name: true } },
        },
      },
      // Contact details are shared only between the two parties of the order.
      customer: { select: { id: true, fullName: true, phone: true, avatarUpdatedAt: true } },
      provider: { select: { id: true, userId: true, displayName: true, ratingAverage: true, ratingCount: true, user: { select: { phone: true, avatarUpdatedAt: true } } } },
      history: { orderBy: { createdAt: "asc" }, select: { id: true, fromStatus: true, toStatus: true, note: true, createdAt: true } },
      review: { select: { id: true, rating: true, comment: true, createdAt: true, status: true } },
      paymentStatus: true,
      paidAt: true,
      settlement: {
        select: { status: true, grossAmount: true, commissionRateBps: true, commissionAmount: true, providerAmount: true, heldAt: true, releasedAt: true, refundedAt: true },
      },
    },
  });
}
