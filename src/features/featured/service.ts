import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import { featuredInputSchema, type Placement } from "./rules";

type FeaturedData = z.output<typeof featuredInputSchema>;

export async function adminListFeatured() {
  return prisma.featuredProvider.findMany({
    orderBy: [{ placement: "asc" }, { sortOrder: "asc" }, { startsAt: "desc" }],
    select: {
      id: true, placement: true, isActive: true, startsAt: true, endsAt: true, price: true, sortOrder: true, createdAt: true,
      provider: { select: { id: true, displayName: true, verificationStatus: true } },
    },
  });
}

async function assertApprovedProvider(providerId: string) {
  const p = await prisma.providerProfile.findUnique({ where: { id: providerId }, select: { verificationStatus: true } });
  if (!p) throw new NotFoundError("متخصص یافت نشد.");
  if (p.verificationStatus !== "APPROVED") throw new AppError("فقط متخصصان تأییدشده می‌توانند ویژه شوند.", "NOT_APPROVED");
}

export async function createFeatured(adminId: string, data: FeaturedData) {
  await assertApprovedProvider(data.providerId);
  await prisma.featuredProvider.create({ data: { ...data, createdById: adminId } });
}

export async function updateFeatured(id: string, data: FeaturedData) {
  await assertApprovedProvider(data.providerId);
  const r = await prisma.featuredProvider.updateMany({ where: { id }, data });
  if (r.count === 0) throw new NotFoundError();
}

export async function deleteFeatured(id: string) {
  const r = await prisma.featuredProvider.deleteMany({ where: { id, payments: { none: {} } } });
  if (r.count === 0) throw new AppError("این مورد یافت نشد یا دارای پرداخت است؛ آن را غیرفعال کنید.", "IN_USE");
}

/** Live featured entries for a placement (used by the backend ordering of provider lists). */
export async function getLiveFeatured(placement: Placement, now = new Date()) {
  return prisma.featuredProvider.findMany({
    where: { placement, isActive: true, startsAt: { lte: now }, endsAt: { gt: now }, provider: { verificationStatus: "APPROVED", user: { status: "ACTIVE" } } },
    select: { providerId: true, placement: true, isActive: true, startsAt: true, endsAt: true, sortOrder: true },
  });
}

export async function listApprovedProviderOptions() {
  return prisma.providerProfile.findMany({
    where: { verificationStatus: "APPROVED" },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true },
  });
}
