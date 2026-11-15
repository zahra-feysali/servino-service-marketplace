import { prisma, type TxClient } from "@/lib/prisma";
import { AppError, NotFoundError, isUniqueConstraintError } from "@/lib/errors";
import { Prisma } from "@/generated/prisma/client";
import { hasOptions, sanitizeConfig, type FieldInputData } from "@/features/forms/definitions";
import { categoryInputSchema, serviceInputSchema } from "./schemas";
import type { z } from "zod";

type CategoryData = z.output<typeof categoryInputSchema>;
type ServiceData = z.output<typeof serviceInputSchema>;

const duplicateSlug = () => new AppError("این نامک قبلاً استفاده شده است.", "DUPLICATE", { slug: ["این نامک قبلاً استفاده شده است."] });

// ── Categories (two levels: main category → subcategory) ─────────────────────

async function assertValidParent(parentId: string | null, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw new AppError("دسته‌بندی نمی‌تواند والد خودش باشد.", "INVALID_PARENT");
  const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { parentId: true } });
  if (!parent) throw new NotFoundError("دسته‌بندی والد یافت نشد.");
  if (parent.parentId) throw new AppError("زیر‌دسته فقط می‌تواند زیر یک دسته‌بندی اصلی قرار بگیرد.", "INVALID_PARENT");
}

export async function createCategory(data: CategoryData) {
  await assertValidParent(data.parentId);
  try {
    return await prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        icon: data.icon ?? null,
        parentId: data.parentId,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
      select: { id: true },
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) throw duplicateSlug();
    throw e;
  }
}

export async function updateCategory(id: string, data: CategoryData) {
  const existing = await prisma.category.findUnique({ where: { id }, select: { _count: { select: { children: true } } } });
  if (!existing) throw new NotFoundError("دسته‌بندی یافت نشد.");
  await assertValidParent(data.parentId, id);
  if (data.parentId && existing._count.children > 0) {
    throw new AppError("دسته‌بندی‌ای که زیر‌دسته دارد نمی‌تواند خودش زیر‌دسته شود.", "INVALID_PARENT");
  }
  try {
    await prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        icon: data.icon ?? null,
        parentId: data.parentId,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) throw duplicateSlug();
    throw e;
  }
}

export async function deleteCategory(id: string) {
  const c = await prisma.category.findUnique({
    where: { id },
    select: { _count: { select: { children: true, services: true } } },
  });
  if (!c) throw new NotFoundError("دسته‌بندی یافت نشد.");
  if (c._count.children > 0 || c._count.services > 0) {
    throw new AppError("این دسته‌بندی دارای زیر‌دسته یا خدمت است و قابل حذف نیست؛ به جای حذف آن را غیرفعال کنید.", "IN_USE");
  }
  await prisma.category.delete({ where: { id } });
}

// ── Services ─────────────────────────────────────────────────────────────────

export async function createService(data: ServiceData) {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
  if (!category) throw new NotFoundError("دسته‌بندی یافت نشد.");
  try {
    return await prisma.service.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        slug: data.slug,
        shortDescription: data.shortDescription ?? null,
        description: data.description ?? null,
        icon: data.icon ?? null,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
      select: { id: true },
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) throw duplicateSlug();
    throw e;
  }
}

export async function updateService(id: string, data: ServiceData) {
  const category = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } });
  if (!category) throw new NotFoundError("دسته‌بندی یافت نشد.");
  try {
    const result = await prisma.service.updateMany({
      where: { id },
      data: {
        categoryId: data.categoryId,
        name: data.name,
        slug: data.slug,
        shortDescription: data.shortDescription ?? null,
        description: data.description ?? null,
        icon: data.icon ?? null,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
    if (result.count === 0) throw new NotFoundError("خدمت یافت نشد.");
  } catch (e) {
    if (isUniqueConstraintError(e)) throw duplicateSlug();
    throw e;
  }
}

export async function deleteService(id: string) {
  const s = await prisma.service.findUnique({
    where: { id },
    select: { _count: { select: { requests: true, providerServices: true, orders: true } } },
  });
  if (!s) throw new NotFoundError("خدمت یافت نشد.");
  if (s._count.requests > 0 || s._count.providerServices > 0 || s._count.orders > 0) {
    throw new AppError("برای این خدمت درخواست ثبت شده یا متخصصی آن را ارائه می‌دهد؛ به جای حذف آن را غیرفعال کنید.", "IN_USE");
  }
  await prisma.service.delete({ where: { id } });
}

// ── Dynamic form fields ──────────────────────────────────────────────────────
// Every change bumps Service.formVersion in the same transaction. Past requests keep
// their own formSnapshot, so editing/deleting fields never corrupts history.

function fieldData(input: FieldInputData) {
  const isOptionType = hasOptions(input.type);
  const defaultValue = input.defaultValue === undefined || input.defaultValue === "" ? null : input.defaultValue;
  return {
    label: input.label,
    name: input.name,
    type: input.type,
    isRequired: input.isRequired,
    isActive: input.isActive,
    options: isOptionType ? (input.options as Prisma.InputJsonValue) : undefined,
    defaultValue: defaultValue === null || input.type === "FILE" ? undefined : (defaultValue as Prisma.InputJsonValue),
    helpText: input.helpText || null,
    placeholder: input.placeholder || null,
    config: (sanitizeConfig(input.type, input.config) ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

async function bumpFormVersion(tx: TxClient, serviceId: string) {
  await tx.service.update({ where: { id: serviceId }, data: { formVersion: { increment: 1 } } });
}

const duplicateFieldName = () =>
  new AppError("این نام فنی در فرم این خدمت تکراری است.", "DUPLICATE", { name: ["این نام فنی در فرم این خدمت تکراری است."] });

export async function createField(serviceId: string, input: FieldInputData) {
  try {
    return await prisma.$transaction(async (tx) => {
      const service = await tx.service.findUnique({ where: { id: serviceId }, select: { id: true } });
      if (!service) throw new NotFoundError("خدمت یافت نشد.");
      const last = await tx.serviceFormField.aggregate({ where: { serviceId }, _max: { sortOrder: true } });
      const data = fieldData(input);
      const field = await tx.serviceFormField.create({
        data: {
          ...data,
          options: data.options ?? undefined,
          serviceId,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
        select: { id: true },
      });
      await bumpFormVersion(tx, serviceId);
      return field;
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) throw duplicateFieldName();
    throw e;
  }
}

export async function updateField(fieldId: string, input: FieldInputData) {
  try {
    await prisma.$transaction(async (tx) => {
      const field = await tx.serviceFormField.findUnique({ where: { id: fieldId }, select: { serviceId: true } });
      if (!field) throw new NotFoundError("فیلد یافت نشد.");
      const data = fieldData(input);
      await tx.serviceFormField.update({
        where: { id: fieldId },
        data: {
          ...data,
          // Explicitly clear JSON columns that no longer apply after a type change.
          options: data.options ?? Prisma.DbNull,
          defaultValue: data.defaultValue ?? Prisma.DbNull,
          config: data.config ?? Prisma.DbNull,
        },
      });
      await bumpFormVersion(tx, field.serviceId);
    });
  } catch (e) {
    if (isUniqueConstraintError(e)) throw duplicateFieldName();
    throw e;
  }
}

export async function setFieldActive(fieldId: string, isActive: boolean) {
  await prisma.$transaction(async (tx) => {
    const field = await tx.serviceFormField.findUnique({ where: { id: fieldId }, select: { serviceId: true } });
    if (!field) throw new NotFoundError("فیلد یافت نشد.");
    await tx.serviceFormField.update({ where: { id: fieldId }, data: { isActive } });
    await bumpFormVersion(tx, field.serviceId);
  });
}

export async function deleteField(fieldId: string) {
  await prisma.$transaction(async (tx) => {
    const field = await tx.serviceFormField.findUnique({ where: { id: fieldId }, select: { serviceId: true } });
    if (!field) throw new NotFoundError("فیلد یافت نشد.");
    await tx.serviceFormField.delete({ where: { id: fieldId } });
    await bumpFormVersion(tx, field.serviceId);
  });
}

/** Swaps the field with its neighbour and renumbers the whole form 0..n-1 (stable ordering). */
export async function moveField(fieldId: string, direction: "up" | "down") {
  await prisma.$transaction(async (tx) => {
    const field = await tx.serviceFormField.findUnique({ where: { id: fieldId }, select: { serviceId: true } });
    if (!field) throw new NotFoundError("فیلد یافت نشد.");
    const fields = await tx.serviceFormField.findMany({
      where: { serviceId: field.serviceId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const ids = fields.map((f) => f.id);
    const index = ids.indexOf(fieldId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    for (const [i, id] of ids.entries()) {
      await tx.serviceFormField.update({ where: { id }, data: { sortOrder: i } });
    }
    await bumpFormVersion(tx, field.serviceId);
  });
}
