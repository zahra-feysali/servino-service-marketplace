import { prisma, type TxClient } from "@/lib/prisma";
import { AppError, ForbiddenError, NotFoundError, isUniqueConstraintError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { notify } from "@/features/notifications/service";
import { debitWallet } from "@/features/finance/wallet";
import { simulatedPaymentsEnabled, simulatedTrackingCode } from "@/features/payments/rules";
import { formatDate } from "@/lib/utils";
import { PLACEMENT_LABELS } from "./rules";
import { PURCHASED_SORT_ORDER, featuredState, purchaseWindow, type FeaturedPlanInput } from "./purchase-rules";

/**
 * Provider buys a featured plan. Wallet: paid and activated atomically. Gateway: a pending
 * placement + payment are created; `settlePayment` activates it exactly once on success.
 * The amount always comes from the plan row, never from the client.
 */
export async function purchaseFeaturedPlan(userId: string, planId: string, method: "WALLET" | "GATEWAY") {
  if (method === "GATEWAY" && !simulatedPaymentsEnabled()) {
    throw new AppError("درگاه پرداخت شبیه‌سازی‌شده در این محیط غیرفعال است.", "SIMULATION_DISABLED");
  }
  return prisma.$transaction(async (tx) => {
    const profile = await tx.providerProfile.findUnique({
      where: { userId },
      select: { id: true, verificationStatus: true, user: { select: { status: true } } },
    });
    if (!profile) throw new ForbiddenError("فقط متخصصان می‌توانند پلن ویژه بخرند.");
    if (profile.verificationStatus !== "APPROVED" || profile.user.status !== "ACTIVE") {
      throw new AppError("خرید پلن ویژه پس از تأیید پروفایل حرفه‌ای امکان‌پذیر است.", "NOT_APPROVED");
    }
    const plan = await tx.featuredPlan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) throw new NotFoundError("این پلن در دسترس نیست.");

    const now = new Date();
    const entry = await tx.featuredProvider.create({
      data: {
        providerId: profile.id,
        placement: plan.placement,
        planId: plan.id,
        source: "PURCHASE",
        isActive: false,
        startsAt: now,
        endsAt: now,
        price: plan.price,
        sortOrder: PURCHASED_SORT_ORDER,
      },
      select: { id: true },
    });

    if (method === "GATEWAY" && plan.price > 0) {
      const payment = await tx.payment.create({
        data: { userId, amount: plan.price, purpose: "FEATURED_PLACEMENT", status: "PENDING", gateway: "SIMULATED", isSimulated: true, featuredProviderId: entry.id },
        select: { id: true },
      });
      return { paymentId: payment.id, status: "PENDING" as const };
    }

    const payment = await tx.payment.create({
      data: {
        userId, amount: plan.price, purpose: "FEATURED_PLACEMENT", status: "SUCCEEDED", gateway: "WALLET", isSimulated: true,
        featuredProviderId: entry.id, paidAt: now, trackingCode: simulatedTrackingCode(),
      },
      select: { id: true },
    });
    if (plan.price > 0) {
      // Throws INSUFFICIENT_BALANCE and rolls the whole purchase back.
      await debitWallet(tx, userId, plan.price, "FEATURED_PURCHASE", { paymentId: payment.id, description: `خرید پلن ویژه ${plan.name}` });
    }
    await activateFeaturedPurchase(tx, entry.id);
    return { paymentId: payment.id, status: "SUCCEEDED" as const };
  });
}

/**
 * Activates a paid purchase (called inside the payment transaction). Locks the provider row so
 * concurrent activations stack correctly; a second call for the same entry is a no-op.
 */
export async function activateFeaturedPurchase(tx: TxClient, featuredId: string) {
  const entry = await tx.featuredProvider.findUnique({
    where: { id: featuredId },
    select: { id: true, providerId: true, placement: true, source: true, paidAt: true, plan: { select: { name: true, durationDays: true } }, provider: { select: { userId: true } } },
  });
  if (!entry || entry.source !== "PURCHASE" || !entry.plan) throw new AppError("جایگاه ویژه مرتبط با پرداخت یافت نشد.", "INVALID_STATE");
  if (entry.paidAt) return null;
  await lockRow(tx, "ProviderProfile", entry.providerId);

  const now = new Date();
  const latest = await tx.featuredProvider.findFirst({
    where: { providerId: entry.providerId, placement: entry.placement, isActive: true, paidAt: { not: null }, endsAt: { gt: now }, id: { not: entry.id } },
    orderBy: { endsAt: "desc" },
    select: { endsAt: true },
  });
  const window = purchaseWindow(now, latest?.endsAt ?? null, entry.plan.durationDays);
  await tx.featuredProvider.update({ where: { id: entry.id }, data: { ...window, isActive: true, paidAt: now } });
  await notify(tx, [
    {
      userId: entry.provider.userId,
      type: "SYSTEM",
      title: `پلن ویژه «${entry.plan.name}» فعال شد`,
      body: `نمایش ویژه در ${PLACEMENT_LABELS[entry.placement]} از ${formatDate(window.startsAt)} تا ${formatDate(window.endsAt)}`,
      link: "/dashboard/provider/featured",
    },
  ]);
  return window;
}

/** Provider's featured placements (purchased and admin-granted) with display state. */
export async function listProviderFeatured(userId: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { userId }, select: { id: true, verificationStatus: true } });
  if (!profile) return { approved: false, entries: [] };
  const rows = await prisma.featuredProvider.findMany({
    where: { providerId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, placement: true, source: true, isActive: true, paidAt: true, startsAt: true, endsAt: true, price: true, createdAt: true,
      plan: { select: { name: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, gateway: true } },
    },
  });
  const now = new Date();
  return {
    approved: profile.verificationStatus === "APPROVED",
    entries: rows.map((r) => ({ ...r, state: featuredState(r, r.payments[0]?.status ?? null, now), payment: r.payments[0] ?? null })),
  };
}

export async function listActiveFeaturedPlans() {
  return prisma.featuredPlan.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] });
}

// ── Admin plan management ────────────────────────────────────────────────────

export async function adminListFeaturedPlans() {
  const plans = await prisma.featuredPlan.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { purchases: { where: { paidAt: { not: null } } } } } },
  });
  return plans.map(({ _count, ...p }) => ({ ...p, purchaseCount: _count.purchases }));
}

const SLUG_TAKEN = new AppError("این نامک قبلاً استفاده شده است.", "VALIDATION", { slug: ["این نامک قبلاً استفاده شده است."] });

export async function saveFeaturedPlan(id: string | null, input: FeaturedPlanInput) {
  try {
    if (id) {
      const r = await prisma.featuredPlan.updateMany({ where: { id }, data: input });
      if (r.count === 0) throw new NotFoundError("پلن یافت نشد.");
    } else {
      await prisma.featuredPlan.create({ data: input });
    }
  } catch (e) {
    if (isUniqueConstraintError(e)) throw SLUG_TAKEN;
    throw e;
  }
}

/** Plans with purchases are kept for history (deactivated instead of deleted). */
export async function deleteFeaturedPlan(id: string): Promise<"DELETED" | "DEACTIVATED"> {
  const used = await prisma.featuredProvider.count({ where: { planId: id } });
  if (used > 0) {
    await prisma.featuredPlan.update({ where: { id }, data: { isActive: false } });
    return "DEACTIVATED";
  }
  const r = await prisma.featuredPlan.deleteMany({ where: { id } });
  if (r.count === 0) throw new NotFoundError("پلن یافت نشد.");
  return "DELETED";
}
