import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError, isUniqueConstraintError } from "@/lib/errors";
import { planInputSchema } from "./lifecycle";

type PlanData = z.output<typeof planInputSchema>;

/**
 * Plan administration. Plans are never hard-coded; existing subscriptions keep their own
 * `planSnapshot`, so editing a plan never changes terms already purchased.
 */
export async function adminListPlans() {
  return prisma.plan.findMany({
    orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });
}

export async function savePlan(id: string | null, data: PlanData) {
  try {
    if (id) {
      const r = await prisma.plan.updateMany({ where: { id }, data });
      if (r.count === 0) throw new NotFoundError("پلن یافت نشد.");
    } else {
      await prisma.plan.create({ data });
    }
  } catch (e) {
    if (isUniqueConstraintError(e)) throw new AppError("این نامک قبلاً استفاده شده است.", "DUPLICATE", { slug: ["این نامک قبلاً استفاده شده است."] });
    throw e;
  }
}

export async function setPlanActive(id: string, isActive: boolean) {
  const r = await prisma.plan.updateMany({ where: { id }, data: { isActive } });
  if (r.count === 0) throw new NotFoundError("پلن یافت نشد.");
}

export async function deletePlan(id: string) {
  const r = await prisma.plan.deleteMany({ where: { id, subscriptions: { none: {} } } });
  if (r.count === 0) throw new AppError("این پلن دارای اشتراک است و قابل حذف نیست؛ آن را غیرفعال کنید.", "IN_USE");
}
