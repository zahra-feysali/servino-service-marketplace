import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError, isUniqueConstraintError } from "@/lib/errors";

/**
 * Admin city management. Deactivating hides a city/province from request forms, address forms,
 * provider area selection and public filters, but keeps every existing record (requests, addresses,
 * provider areas). Deleting is only allowed for unused records, so no data is ever lost.
 */

export const locationSchema = z.object({
  name: z.string().trim().min(2, "نام را وارد کنید.").max(80, "نام بیش از حد طولانی است."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "نامک فقط حروف کوچک انگلیسی، عدد و خط تیره."),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type LocationInput = z.infer<typeof locationSchema>;

function duplicate(e: unknown): never {
  if (isUniqueConstraintError(e)) {
    throw new AppError("نام یا نامک تکراری است.", "VALIDATION", { slug: ["نام یا نامک تکراری است."], name: ["نام یا نامک تکراری است."] });
  }
  throw e;
}

export async function saveProvince(id: string | null, input: LocationInput) {
  try {
    if (id) {
      const r = await prisma.province.updateMany({ where: { id }, data: input });
      if (r.count === 0) throw new NotFoundError("استان یافت نشد.");
    } else {
      await prisma.province.create({ data: input });
    }
  } catch (e) {
    duplicate(e);
  }
}

export async function saveCity(id: string | null, provinceId: string, input: LocationInput) {
  const province = await prisma.province.count({ where: { id: provinceId } });
  if (!province) throw new AppError("استان انتخاب‌شده یافت نشد.", "VALIDATION", { provinceId: ["استان انتخاب‌شده یافت نشد."] });
  try {
    if (id) {
      const r = await prisma.city.updateMany({ where: { id }, data: { ...input, provinceId } });
      if (r.count === 0) throw new NotFoundError("شهر یافت نشد.");
    } else {
      await prisma.city.create({ data: { ...input, provinceId } });
    }
  } catch (e) {
    duplicate(e);
  }
}

export async function setProvinceActive(id: string, isActive: boolean) {
  const r = await prisma.province.updateMany({ where: { id }, data: { isActive } });
  if (r.count === 0) throw new NotFoundError("استان یافت نشد.");
}

export async function setCityActive(id: string, isActive: boolean) {
  const r = await prisma.city.updateMany({ where: { id }, data: { isActive } });
  if (r.count === 0) throw new NotFoundError("شهر یافت نشد.");
}

/** Usage that blocks deletion (shown to the admin). */
export async function cityUsage(id: string) {
  const c = await prisma.city.findUnique({
    where: { id },
    select: { _count: { select: { serviceAreas: true, addresses: true, requests: true } } },
  });
  if (!c) throw new NotFoundError("شهر یافت نشد.");
  return c._count;
}

export async function deleteCity(id: string) {
  const u = await cityUsage(id);
  if (u.requests + u.addresses + u.serviceAreas > 0) {
    throw new AppError(
      `این شهر در ${u.requests.toLocaleString("fa-IR")} درخواست، ${u.addresses.toLocaleString("fa-IR")} نشانی و ${u.serviceAreas.toLocaleString("fa-IR")} منطقه متخصص استفاده شده است؛ به‌جای حذف، آن را غیرفعال کنید.`,
      "IN_USE",
    );
  }
  await prisma.city.delete({ where: { id } });
}

export async function deleteProvince(id: string) {
  const p = await prisma.province.findUnique({ where: { id }, select: { _count: { select: { cities: true } } } });
  if (!p) throw new NotFoundError("استان یافت نشد.");
  if (p._count.cities > 0) throw new AppError("ابتدا شهرهای این استان را حذف یا منتقل کنید؛ یا استان را غیرفعال کنید.", "IN_USE");
  await prisma.province.delete({ where: { id } });
}
