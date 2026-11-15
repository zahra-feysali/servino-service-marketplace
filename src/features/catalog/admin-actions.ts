"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { isUuid } from "@/lib/db-locks";
import { fieldInputSchema, type FieldInput } from "@/features/forms/definitions";
import { categoryInputSchema, serviceInputSchema, type CategoryInput, type ServiceInput } from "./schemas";
import * as admin from "./admin-service";

/** All catalog mutations are ADMIN-only (checked server-side against the database). */

const INVALID = "اطلاعات وارد شده معتبر نیست.";
const NOT_FOUND = "مورد درخواستی یافت نشد.";

function revalidateCatalog(serviceId?: string) {
  revalidatePath("/dashboard/admin/catalog");
  if (serviceId) revalidatePath(`/dashboard/admin/catalog/services/${serviceId}`);
  revalidatePath("/services");
  revalidatePath("/");
}

export async function saveCategoryAction(id: string | null, input: CategoryInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("ADMIN");
    const parsed = categoryInputSchema.safeParse(input);
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    if (id) {
      if (!isUuid(id)) return fail(NOT_FOUND);
      await admin.updateCategory(id, parsed.data);
      revalidateCatalog();
      return ok({ id }, "دسته‌بندی به‌روزرسانی شد.");
    }
    const created = await admin.createCategory(parsed.data);
    revalidateCatalog();
    return ok(created, "دسته‌بندی ایجاد شد.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    if (!isUuid(id)) return fail(NOT_FOUND);
    await admin.deleteCategory(id);
    revalidateCatalog();
    return ok(undefined, "دسته‌بندی حذف شد.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveServiceAction(id: string | null, input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("ADMIN");
    const parsed = serviceInputSchema.safeParse(input);
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    if (id) {
      if (!isUuid(id)) return fail(NOT_FOUND);
      await admin.updateService(id, parsed.data);
      revalidateCatalog(id);
      return ok({ id }, "خدمت به‌روزرسانی شد.");
    }
    const created = await admin.createService(parsed.data);
    revalidateCatalog();
    return ok(created, "خدمت ایجاد شد.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    if (!isUuid(id)) return fail(NOT_FOUND);
    await admin.deleteService(id);
    revalidateCatalog();
    return ok(undefined, "خدمت حذف شد.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveFieldAction(
  serviceId: string,
  fieldId: string | null,
  input: FieldInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole("ADMIN");
    if (!isUuid(serviceId) || (fieldId !== null && !isUuid(fieldId))) return fail(NOT_FOUND);
    const parsed = fieldInputSchema.safeParse(input);
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    if (fieldId) {
      await admin.updateField(fieldId, parsed.data);
      revalidateCatalog(serviceId);
      return ok({ id: fieldId }, "فیلد به‌روزرسانی شد.");
    }
    const created = await admin.createField(serviceId, parsed.data);
    revalidateCatalog(serviceId);
    return ok(created, "فیلد اضافه شد.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function setFieldActiveAction(serviceId: string, fieldId: string, isActive: boolean): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    if (!isUuid(fieldId) || typeof isActive !== "boolean") return fail(NOT_FOUND);
    await admin.setFieldActive(fieldId, isActive);
    revalidateCatalog(serviceId);
    return ok(undefined, isActive ? "فیلد فعال شد." : "فیلد غیرفعال شد.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteFieldAction(serviceId: string, fieldId: string): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    if (!isUuid(fieldId)) return fail(NOT_FOUND);
    await admin.deleteField(fieldId);
    revalidateCatalog(serviceId);
    return ok(undefined, "فیلد حذف شد. درخواست‌های قبلی همچنان نسخه ذخیره‌شده فرم را نگه می‌دارند.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function moveFieldAction(serviceId: string, fieldId: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    if (!isUuid(fieldId) || (direction !== "up" && direction !== "down")) return fail(NOT_FOUND);
    await admin.moveField(fieldId, direction);
    revalidateCatalog(serviceId);
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}
