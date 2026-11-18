import { prisma, type TxClient } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { notify } from "@/features/notifications/service";
import { simulatedPaymentsEnabled, simulatedTrackingCode } from "@/features/payments/rules";
import { formatPrice, toPersianDigits } from "@/lib/utils";
import { creditWallet, debitWallet } from "./wallet";
import { DEFAULT_COMMISSION_BPS, ORDER_PAYMENT_ERROR_MESSAGES, canPayOrder, computeSplit } from "./rules";

/**
 * Order payments, commission and escrow.
 *
 * Money flow: the customer pays the full order price (wallet or gateway) → an OrderSettlement is
 * created with the commission rate in force at that moment (HELD) → on COMPLETED the provider share
 * is credited to the provider wallet and the commission is earned (RELEASED) → on CANCELLED the full
 * amount goes back to the customer wallet (REFUNDED). Every step runs in one transaction with the
 * order row locked; settlement rows are unique per order, so nothing can happen twice.
 */

export const COMMISSION_SETTING_KEY = "finance.commissionBps";

export async function getCommissionRateBps(db: TxClient | typeof prisma = prisma): Promise<number> {
  const row = await db.siteSetting.findUnique({ where: { key: COMMISSION_SETTING_KEY } });
  const v = row?.value;
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 5_000 ? v : DEFAULT_COMMISSION_BPS;
}

/**
 * Records a successful order payment (called inside the payment transaction).
 * If the order was already paid in the meantime (e.g. a wallet payment won the race against a
 * gateway payment), the duplicate amount is credited back to the customer wallet instead.
 */
export async function applyOrderPayment(tx: TxClient, orderId: string, payment: { id: string; userId: string; amount: number }) {
  if (!(await lockRow(tx, "Order", orderId))) throw new NotFoundError("سفارش یافت نشد.");
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { id: true, code: true, customerId: true, providerId: true, price: true, status: true, paymentStatus: true, provider: { select: { userId: true } } },
  });

  const error = canPayOrder(order, payment.userId);
  if (error || payment.amount !== order.price) {
    // Duplicate / stale payment: never lose the customer's money.
    await creditWallet(tx, payment.userId, payment.amount, "REFUND", {
      paymentId: payment.id,
      orderId,
      description: `بازگشت پرداخت تکراری یا نامعتبر سفارش ${toPersianDigits(order.code)}`,
    });
    return { applied: false as const };
  }

  const rate = await getCommissionRateBps(tx);
  const split = computeSplit(order.price, rate);
  await tx.orderSettlement.create({
    data: {
      orderId,
      paymentId: payment.id,
      providerId: order.providerId,
      customerId: order.customerId,
      grossAmount: split.grossAmount,
      commissionRateBps: split.commissionRateBps,
      commissionAmount: split.commissionAmount,
      providerAmount: split.providerAmount,
      status: "HELD",
    },
  });
  await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "PAID", paidAt: new Date() } });
  await notify(tx, [
    {
      userId: order.provider.userId,
      type: "PAYMENT_SUCCEEDED",
      title: `مشتری هزینه سفارش ${toPersianDigits(order.code)} را پرداخت کرد`,
      body: `سهم شما ${formatPrice(split.providerAmount)} پس از تأیید تکمیل سفارش آزاد می‌شود.`,
      link: `/dashboard/provider/orders/${orderId}`,
    },
  ]);
  return { applied: true as const, split };
}

/** Customer pays an order from the wallet balance (atomic; insufficient balance is rejected). */
export async function payOrderWithWallet(customerId: string, orderId: string) {
  return prisma.$transaction(async (tx) => {
    if (!(await lockRow(tx, "Order", orderId))) throw new NotFoundError("سفارش یافت نشد.");
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { code: true, customerId: true, status: true, paymentStatus: true, price: true } });
    const error = canPayOrder(order, customerId);
    if (error === "NOT_OWNER") throw new ForbiddenError(ORDER_PAYMENT_ERROR_MESSAGES.NOT_OWNER);
    if (error) throw new AppError(ORDER_PAYMENT_ERROR_MESSAGES[error], error);

    const payment = await tx.payment.create({
      data: {
        userId: customerId, amount: order.price, purpose: "ORDER", status: "SUCCEEDED", gateway: "WALLET", isSimulated: true,
        orderId, paidAt: new Date(), trackingCode: simulatedTrackingCode(),
      },
      select: { id: true, userId: true, amount: true },
    });
    await debitWallet(tx, customerId, order.price, "ORDER_PAYMENT", {
      paymentId: payment.id,
      orderId,
      description: `پرداخت سفارش ${toPersianDigits(order.code)}`,
    });
    await applyOrderPayment(tx, orderId, payment);
    return { paymentId: payment.id };
  });
}

/** Starts (or reuses) a pending gateway payment for an order; the amount always comes from the order. */
export async function startOrderGatewayPayment(customerId: string, orderId: string) {
  if (!simulatedPaymentsEnabled()) {
    throw new AppError("درگاه پرداخت شبیه‌سازی‌شده در این محیط غیرفعال است.", "SIMULATION_DISABLED");
  }
  return prisma.$transaction(async (tx) => {
    if (!(await lockRow(tx, "Order", orderId))) throw new NotFoundError("سفارش یافت نشد.");
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { customerId: true, status: true, paymentStatus: true, price: true } });
    const error = canPayOrder(order, customerId);
    if (error === "NOT_OWNER") throw new ForbiddenError(ORDER_PAYMENT_ERROR_MESSAGES.NOT_OWNER);
    if (error) throw new AppError(ORDER_PAYMENT_ERROR_MESSAGES[error], error);

    const pending = await tx.payment.findFirst({
      where: { orderId, userId: customerId, status: "PENDING", purpose: "ORDER", amount: order.price },
      select: { id: true },
    });
    if (pending) return { paymentId: pending.id };
    const payment = await tx.payment.create({
      data: { userId: customerId, amount: order.price, purpose: "ORDER", status: "PENDING", gateway: "SIMULATED", isSimulated: true, orderId },
      select: { id: true },
    });
    return { paymentId: payment.id };
  });
}

/**
 * Applies the escrow side effect of an order status change (called from changeOrderStatus inside
 * its transaction, with the order row already locked). Unpaid orders have no settlement → no-op.
 */
export async function applySettlementForOrderStatus(tx: TxClient, orderId: string, to: "COMPLETED" | "CANCELLED", note?: string | null) {
  const settlement = await tx.orderSettlement.findUnique({
    where: { orderId },
    select: { id: true, status: true, customerId: true, grossAmount: true, providerAmount: true, commissionAmount: true, provider: { select: { userId: true } }, order: { select: { code: true } } },
  });
  if (!settlement || settlement.status !== "HELD") return null;
  const code = toPersianDigits(settlement.order.code);

  if (to === "COMPLETED") {
    const updated = await tx.orderSettlement.updateMany({ where: { id: settlement.id, status: "HELD" }, data: { status: "RELEASED", releasedAt: new Date() } });
    if (updated.count !== 1) return null;
    if (settlement.providerAmount > 0) {
      await creditWallet(tx, settlement.provider.userId, settlement.providerAmount, "ORDER_EARNING", {
        orderId,
        description: `سهم شما از سفارش ${code} (پس از کسر کمیسیون ${formatPrice(settlement.commissionAmount)})`,
      });
    }
    await notify(tx, [
      {
        userId: settlement.provider.userId,
        type: "PAYMENT_SUCCEEDED",
        title: `سهم شما از سفارش ${code} آزاد شد`,
        body: `${formatPrice(settlement.providerAmount)} به کیف پول شما اضافه شد.`,
        link: "/dashboard/provider/wallet",
      },
    ]);
    return "RELEASED" as const;
  }

  const updated = await tx.orderSettlement.updateMany({
    where: { id: settlement.id, status: "HELD" },
    data: { status: "REFUNDED", refundedAt: new Date(), note: note?.trim() || null },
  });
  if (updated.count !== 1) return null;
  await creditWallet(tx, settlement.customerId, settlement.grossAmount, "REFUND", { orderId, description: `بازپرداخت سفارش لغوشده ${code}` });
  await tx.order.update({ where: { id: orderId }, data: { paymentStatus: "REFUNDED" } });
  await notify(tx, [
    {
      userId: settlement.customerId,
      type: "PAYMENT_SUCCEEDED",
      title: `مبلغ سفارش ${code} به کیف پول شما بازگشت`,
      body: formatPrice(settlement.grossAmount),
      link: "/dashboard/customer/wallet",
    },
  ]);
  return "REFUNDED" as const;
}

// ── Queries ─────────────────────────────────────────────────────────────────

export async function getOrderPaymentInfo(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      paymentStatus: true,
      paidAt: true,
      price: true,
      settlement: {
        select: { status: true, grossAmount: true, commissionRateBps: true, commissionAmount: true, providerAmount: true, heldAt: true, releasedAt: true, refundedAt: true },
      },
      payments: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
}
