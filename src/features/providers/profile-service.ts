import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError, isUniqueConstraintError } from "@/lib/errors";
import { lockRow } from "@/lib/db-locks";
import { DOCUMENT_MIME_TYPES, IMAGE_MIME_TYPES, readValidatedFile } from "@/lib/uploads";
import { deleteStoredFiles, saveFile } from "@/lib/storage";
import { notify } from "@/features/notifications/service";
import { getProviderProfileByUserId } from "./service";
import {
  MAX_DOCUMENTS,
  MAX_PORTFOLIO_ITEMS,
  MAX_PROVIDER_SERVICES,
  MAX_SERVICE_AREAS,
  MAX_SKILLS,
  canSubmitForVerification,
} from "./verification";

/** All functions take the provider's *user id* from the session and resolve their own profile. */

export async function getProviderWorkspace(userId: string) {
  const profile = await prisma.providerProfile.findUnique({
    where: { userId },
    select: {
      id: true, displayName: true, bio: true, yearsOfExperience: true, verificationStatus: true, rejectionReason: true,
      submittedAt: true, reviewedAt: true, ratingAverage: true, ratingCount: true, completedOrdersCount: true,
      services: { select: { serviceId: true, service: { select: { name: true, isActive: true } } } },
      areas: { select: { cityId: true, city: { select: { name: true } } } },
      skills: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } },
      portfolio: { orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, description: true, imageKey: true } },
      documents: { orderBy: { createdAt: "desc" }, select: { id: true, type: true, title: true, fileName: true, mimeType: true, size: true, status: true, reviewNote: true, createdAt: true } },
    },
  });
  if (!profile) throw new NotFoundError("پروفایل متخصص یافت نشد.");
  return profile;
}

export async function updateProviderProfile(userId: string, data: { displayName: string; bio: string | null; yearsOfExperience: number }) {
  const profile = await getProviderProfileByUserId(userId);
  await prisma.providerProfile.update({ where: { id: profile.id }, data });
}

/** Replaces the provider's offered services with the given set (active services only). */
export async function setProviderServices(userId: string, serviceIds: string[]) {
  const unique = [...new Set(serviceIds)];
  if (unique.length > MAX_PROVIDER_SERVICES) throw new AppError(`حداکثر ${MAX_PROVIDER_SERVICES} خدمت قابل انتخاب است.`, "VALIDATION");
  const profile = await getProviderProfileByUserId(userId);
  const valid = await prisma.service.findMany({ where: { id: { in: unique }, isActive: true }, select: { id: true } });
  if (valid.length !== unique.length) throw new AppError("برخی خدمات انتخاب‌شده معتبر یا فعال نیستند.", "VALIDATION");
  // Links to services that are currently inactive are kept (not shown in the form), so re-activating
  // a service restores them instead of silently losing the provider's choice.
  await prisma.$transaction([
    prisma.providerService.deleteMany({ where: { providerId: profile.id, serviceId: { notIn: unique }, service: { isActive: true } } }),
    prisma.providerService.createMany({ data: unique.map((serviceId) => ({ providerId: profile.id, serviceId })), skipDuplicates: true }),
  ]);
}

/** Replaces the provider's service areas (cities) with the given set (active cities only). */
export async function setProviderAreas(userId: string, cityIds: string[]) {
  const unique = [...new Set(cityIds)];
  if (unique.length > MAX_SERVICE_AREAS) throw new AppError(`حداکثر ${MAX_SERVICE_AREAS} شهر قابل انتخاب است.`, "VALIDATION");
  const profile = await getProviderProfileByUserId(userId);
  const valid = await prisma.city.findMany({ where: { id: { in: unique }, isActive: true, province: { isActive: true } }, select: { id: true } });
  if (valid.length !== unique.length) throw new AppError("برخی شهرهای انتخاب‌شده معتبر نیستند.", "VALIDATION");
  // Areas in deactivated cities/provinces are kept (hidden from the form) so nothing is lost if the
  // admin re-activates them; only areas in currently active cities are replaced.
  await prisma.$transaction([
    prisma.serviceArea.deleteMany({
      where: { providerId: profile.id, cityId: { notIn: unique }, city: { isActive: true, province: { isActive: true } } },
    }),
    prisma.serviceArea.createMany({ data: unique.map((cityId) => ({ providerId: profile.id, cityId })), skipDuplicates: true }),
  ]);
}

export async function addSkill(userId: string, name: string) {
  const profile = await getProviderProfileByUserId(userId);
  const count = await prisma.providerSkill.count({ where: { providerId: profile.id } });
  if (count >= MAX_SKILLS) throw new AppError(`حداکثر ${MAX_SKILLS} مهارت مجاز است.`, "LIMIT");
  try {
    await prisma.providerSkill.create({ data: { providerId: profile.id, name } });
  } catch (e) {
    if (isUniqueConstraintError(e)) throw new AppError("این مهارت قبلاً ثبت شده است.", "DUPLICATE", { name: ["این مهارت قبلاً ثبت شده است."] });
    throw e;
  }
}

export async function removeSkill(userId: string, skillId: string) {
  const profile = await getProviderProfileByUserId(userId);
  const r = await prisma.providerSkill.deleteMany({ where: { id: skillId, providerId: profile.id } });
  if (r.count === 0) throw new NotFoundError();
}

const IMAGE_TYPES = IMAGE_MIME_TYPES;
const DOCUMENT_TYPES = DOCUMENT_MIME_TYPES;

export async function addPortfolioItem(userId: string, data: { title: string; description: string | null }, image: File | null) {
  const profile = await getProviderProfileByUserId(userId);
  const count = await prisma.portfolioItem.count({ where: { providerId: profile.id } });
  if (count >= MAX_PORTFOLIO_ITEMS) throw new AppError(`حداکثر ${MAX_PORTFOLIO_ITEMS} نمونه‌کار مجاز است.`, "LIMIT");
  let key: string | null = null;
  if (image) {
    const f = await readValidatedFile(image, IMAGE_TYPES);
    key = await saveFile(f.bytes, f.mime);
  }
  try {
    await prisma.portfolioItem.create({ data: { providerId: profile.id, title: data.title, description: data.description, imageKey: key, sortOrder: count } });
  } catch (e) {
    if (key) await deleteStoredFiles([key]);
    throw e;
  }
}

export async function removePortfolioItem(userId: string, itemId: string) {
  const profile = await getProviderProfileByUserId(userId);
  const item = await prisma.portfolioItem.findFirst({ where: { id: itemId, providerId: profile.id }, select: { imageKey: true } });
  if (!item) throw new NotFoundError();
  await prisma.portfolioItem.delete({ where: { id: itemId } });
  if (item.imageKey) await deleteStoredFiles([item.imageKey]);
}

export async function addProviderDocument(userId: string, data: { type: "NATIONAL_ID" | "CERTIFICATE" | "LICENSE" | "OTHER"; title: string }, file: File) {
  const profile = await getProviderProfileByUserId(userId);
  const count = await prisma.providerDocument.count({ where: { providerId: profile.id } });
  if (count >= MAX_DOCUMENTS) throw new AppError(`حداکثر ${MAX_DOCUMENTS} مدرک مجاز است.`, "LIMIT");
  const f = await readValidatedFile(file, DOCUMENT_TYPES);
  const key = await saveFile(f.bytes, f.mime);
  try {
    await prisma.providerDocument.create({
      data: { providerId: profile.id, type: data.type, title: data.title, storageKey: key, fileName: f.fileName, mimeType: f.mime, size: f.bytes.byteLength },
    });
  } catch (e) {
    await deleteStoredFiles([key]);
    throw e;
  }
}

/** Providers may delete documents that were not yet approved. */
export async function removeProviderDocument(userId: string, documentId: string) {
  const profile = await getProviderProfileByUserId(userId);
  const doc = await prisma.providerDocument.findFirst({ where: { id: documentId, providerId: profile.id }, select: { storageKey: true, status: true } });
  if (!doc) throw new NotFoundError();
  if (doc.status === "APPROVED") throw new AppError("مدرک تأییدشده قابل حذف نیست.", "INVALID_STATE");
  await prisma.providerDocument.delete({ where: { id: documentId } });
  await deleteStoredFiles([doc.storageKey]);
}

/** DRAFT/REJECTED → PENDING when the profile checklist is complete; notifies admins. */
export async function submitForVerification(userId: string) {
  await prisma.$transaction(async (tx) => {
    const base = await tx.providerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!base) throw new NotFoundError("پروفایل متخصص یافت نشد.");
    await lockRow(tx, "ProviderProfile", base.id);
    const p = await tx.providerProfile.findUniqueOrThrow({
      where: { id: base.id },
      select: { displayName: true, bio: true, verificationStatus: true, _count: { select: { services: true, areas: true, documents: true } } },
    });
    const error = canSubmitForVerification(p.verificationStatus, {
      displayName: p.displayName, bio: p.bio, servicesCount: p._count.services, areasCount: p._count.areas, documentsCount: p._count.documents,
    });
    if (error === "INVALID_STATE") throw new AppError("پروفایل شما در حال بررسی است یا قبلاً تأیید شده است.", error);
    if (error === "INCOMPLETE") throw new AppError("ابتدا همه موارد چک‌لیست پروفایل را تکمیل کنید.", error);

    await tx.providerProfile.update({ where: { id: base.id }, data: { verificationStatus: "PENDING", submittedAt: new Date(), rejectionReason: null } });
    const admins = await tx.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
    await notify(tx, admins.map((a) => ({
      userId: a.id, type: "SYSTEM" as const, title: `درخواست تأیید پروفایل: ${p.displayName}`, link: `/dashboard/admin/providers/${base.id}`,
    })));
  });
}
