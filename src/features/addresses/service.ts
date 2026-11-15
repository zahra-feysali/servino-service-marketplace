import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError } from "@/lib/errors";
import { MAX_ADDRESSES, addressInputSchema } from "./schemas";

type AddressData = z.output<typeof addressInputSchema>;

export async function listAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, title: true, line: true, postalCode: true, isDefault: true, cityId: true, city: { select: { name: true } } },
  });
}

async function assertCity(cityId: string) {
  const ok = await prisma.city.count({ where: { id: cityId, isActive: true } });
  if (!ok) throw new AppError("شهر انتخاب‌شده معتبر نیست.", "VALIDATION", { cityId: ["شهر انتخاب‌شده معتبر نیست."] });
}

export async function createAddress(userId: string, data: AddressData) {
  await assertCity(data.cityId);
  await prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) throw new AppError(`حداکثر ${MAX_ADDRESSES} نشانی مجاز است.`, "LIMIT");
    const isDefault = data.isDefault || count === 0;
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    await tx.address.create({ data: { ...data, isDefault, userId } });
  });
}

export async function updateAddress(userId: string, id: string, data: AddressData) {
  await assertCity(data.cityId);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) throw new NotFoundError("نشانی یافت نشد.");
    if (data.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    await tx.address.update({ where: { id }, data });
  });
}

/** Deleting keeps past requests intact: requests store their own address text. */
export async function deleteAddress(userId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const a = await tx.address.findFirst({ where: { id, userId }, select: { isDefault: true } });
    if (!a) throw new NotFoundError("نشانی یافت نشد.");
    await tx.address.delete({ where: { id } });
    if (a.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}
