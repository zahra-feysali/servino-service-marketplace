import { prisma, type TxClient } from "@/lib/prisma";
import { pageArgs, toPaginated } from "@/lib/pagination";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { debitWallet } from "@/features/finance/wallet";
import { notify } from "@/features/notifications/service";
import { simulatedTrackingCode } from "@/features/payments/rules";
import { formatDate } from "@/lib/utils";
import { computeSubscriptionWindow, extendEndDate, planToSnapshot } from "./lifecycle";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Marks ACTIVE subscriptions past their end date as EXPIRED and notifies their owners.
 * Expiry is enforced at use-time anyway (matching/offers check the window in SQL);
 * this keeps the stored status accurate. Called from dashboards and the admin panel.
 */
export async function expireDueSubscriptions(now = new Date()): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const due = await tx.subscription.findMany({
      where: { status: "ACTIVE", endsAt: { lte: now } },
      select: { id: true, userId: true, plan: { select: { name: true } } },
      take: 500,
    });
    if (due.length === 0) return 0;
    await tx.subscription.updateMany({ where: { id: { in: due.map((d) => d.id) }, status: "ACTIVE" }, data: { status: "EXPIRED" } });
    await notify(
      tx,
      due.map((d) => ({
        userId: d.userId,
        type: "SUBSCRIPTION_EXPIRED" as const,
        title: `اشتراک «${d.plan.name}» منقضی شد`,
        body: "برای ادامه دریافت درخواست‌ها اشتراک جدید تهیه کنید.",
        link: "/dashboard/provider/subscription",
      })),
    );
    return due.length;
  });
}

/** Activates a paid subscription inside the payment transaction (stacking after current active ones). */
export async function activateSubscription(tx: TxClient, subscriptionId: string, now = new Date()) {
  const sub = await tx.subscription.findUniqueOrThrow({
    where: { id: subscriptionId },
    select: { id: true, userId: true, status: true, planSnapshot: true, plan: { select: { name: true, durationDays: true } } },
  });
  if (sub.status !== "PENDING") throw new AppError("این اشتراک در وضعیت قابل فعال‌سازی نیست.", "INVALID_STATE");
  const snapshot = sub.planSnapshot as { durationDays?: number };
  const durationDays = typeof snapshot?.durationDays === "number" ? snapshot.durationDays : sub.plan.durationDays;
  const active = await tx.subscription.findMany({
    where: { userId: sub.userId, status: "ACTIVE", endsAt: { gt: now } },
    select: { endsAt: true },
  });
  const window = computeSubscriptionWindow(now, active.map((a) => a.endsAt!), durationDays);
  await tx.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", startsAt: window.startsAt, endsAt: window.endsAt } });
  await notify(tx, [
    {
      userId: sub.userId,
      type: "SUBSCRIPTION_ACTIVATED",
      title: `اشتراک «${sub.plan.name}» فعال شد`,
      body: `از ${formatDate(window.startsAt)} تا ${formatDate(window.endsAt)}`,
      link: "/dashboard/provider/subscription",
    },
  ]);
  return window;
}

/**
 * Provider buys a plan. The price always comes from the Plan row in the database.
 * - method WALLET: debits the wallet and activates immediately (one transaction).
 * - method GATEWAY: creates a PENDING payment to be completed on the simulated gateway page.
 */
export async function purchaseSubscription(userId: string, planId: string, method: "WALLET" | "GATEWAY") {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (user?.role !== "PROVIDER") throw new ForbiddenError("فقط متخصصان می‌توانند اشتراک تهیه کنند.");
    const plan = await tx.plan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) throw new NotFoundError("این پلن در دسترس نیست.");

    const subscription = await tx.subscription.create({
      data: { userId, planId, status: "PENDING", planSnapshot: planToSnapshot(plan) as Prisma.InputJsonObject },
      select: { id: true },
    });

    if (method === "GATEWAY" || plan.price === 0) {
      if (plan.price === 0) {
        const payment = await tx.payment.create({
          data: {
            userId, amount: 0, purpose: "SUBSCRIPTION", status: "SUCCEEDED", gateway: "WALLET", isSimulated: true,
            subscriptionId: subscription.id, paidAt: new Date(), trackingCode: simulatedTrackingCode(),
          },
          select: { id: true },
        });
        await activateSubscription(tx, subscription.id);
        return { paymentId: payment.id, status: "SUCCEEDED" as const };
      }
      const payment = await tx.payment.create({
        data: { userId, amount: plan.price, purpose: "SUBSCRIPTION", status: "PENDING", gateway: "SIMULATED", isSimulated: true, subscriptionId: subscription.id },
        select: { id: true },
      });
      return { paymentId: payment.id, status: "PENDING" as const };
    }

    const payment = await tx.payment.create({
      data: {
        userId, amount: plan.price, purpose: "SUBSCRIPTION", status: "SUCCEEDED", gateway: "WALLET", isSimulated: true,
        subscriptionId: subscription.id, paidAt: new Date(), trackingCode: simulatedTrackingCode(),
      },
      select: { id: true },
    });
    // Throws INSUFFICIENT_BALANCE (rolling back the whole purchase) if the wallet cannot cover it.
    await debitWallet(tx, userId, plan.price, "SUBSCRIPTION_PURCHASE", { paymentId: payment.id, description: `خرید اشتراک ${plan.name}` });
    await activateSubscription(tx, subscription.id);
    return { paymentId: payment.id, status: "SUCCEEDED" as const };
  });
}

export async function getProviderSubscriptions(userId: string) {
  const now = new Date();
  const subs = await prisma.subscription.findMany({
    where: { userId, status: { not: "PENDING" } },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    select: {
      id: true, status: true, startsAt: true, endsAt: true, requestsReceived: true, offersSubmitted: true, planSnapshot: true, createdAt: true,
      plan: { select: { name: true } },
    },
  });
  const current = subs.filter((s) => s.status === "ACTIVE" && s.endsAt && s.endsAt > now && (!s.startsAt || s.startsAt <= now));
  const upcoming = subs.filter((s) => s.status === "ACTIVE" && s.startsAt && s.startsAt > now);
  return { all: subs, current, upcoming };
}

export async function listActivePlans() {
  return prisma.plan.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] });
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function adminListSubscriptions(status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED" | undefined, page = 1) {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageArgs(page),
      select: {
        id: true, status: true, startsAt: true, endsAt: true, requestsReceived: true, offersSubmitted: true, planSnapshot: true, createdAt: true,
        plan: { select: { name: true } },
        user: { select: { id: true, fullName: true, phone: true } },
      },
    }),
    prisma.subscription.count({ where }),
  ]);
  return toPaginated(items, total, page);
}

export async function adminCancelSubscription(adminId: string, subscriptionId: string, reason: string) {
  await prisma.$transaction(async (tx) => {
    // Lock pending payments first (same order as completeSimulatedPayment) so a concurrent
    // settlement cannot leave a SUCCEEDED payment with a CANCELLED subscription.
    const pendingPayments = await tx.payment.findMany({ where: { subscriptionId, status: "PENDING" }, select: { id: true } });
    for (const p of pendingPayments) await lockRow(tx, "Payment", p.id);
    const sub = await tx.subscription.findUnique({ where: { id: subscriptionId }, select: { status: true, userId: true, plan: { select: { name: true } } } });
    if (!sub) throw new NotFoundError("اشتراک یافت نشد.");
    if (sub.status === "CANCELLED" || sub.status === "EXPIRED") throw new AppError("این اشتراک قبلاً بسته شده است.", "INVALID_STATE");
    await tx.subscription.update({ where: { id: subscriptionId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    if (sub.status === "PENDING") {
      await tx.payment.updateMany({ where: { subscriptionId, status: "PENDING" }, data: { status: "FAILED", failureReason: "لغو اشتراک توسط مدیر" } });
    }
    await notify(tx, [{ userId: sub.userId, type: "SYSTEM", title: `اشتراک «${sub.plan.name}» توسط مدیر لغو شد`, body: reason, link: "/dashboard/provider/subscription" }]);
  });
  void adminId;
}

/** Admin renewal: extends an ACTIVE subscription, or re-activates an EXPIRED one from now. */
export async function adminExtendSubscription(subscriptionId: string, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new AppError("تعداد روز باید بین ۱ تا ۳۶۵ باشد.", "VALIDATION");
  await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { id: subscriptionId }, select: { status: true, endsAt: true, startsAt: true, userId: true } });
    if (!sub) throw new NotFoundError("اشتراک یافت نشد.");
    if (sub.status !== "ACTIVE" && sub.status !== "EXPIRED") throw new AppError("فقط اشتراک فعال یا منقضی قابل تمدید است.", "INVALID_STATE");
    const now = new Date();
    const endsAt = extendEndDate(sub.endsAt ?? now, now, days);
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: { status: "ACTIVE", endsAt, startsAt: sub.status === "EXPIRED" ? now : sub.startsAt ?? now },
    });
    await notify(tx, [{ userId: sub.userId, type: "SUBSCRIPTION_ACTIVATED", title: "اشتراک شما توسط مدیر تمدید شد", body: `تا ${formatDate(endsAt)}`, link: "/dashboard/provider/subscription" }]);
  });
}
