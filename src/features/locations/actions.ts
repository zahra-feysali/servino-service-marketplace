"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { str } from "@/lib/form-data";
import { deleteCity, deleteProvince, locationSchema, saveCity, saveProvince, setCityActive, setProvinceActive } from "./service";

/** ADMIN only (role re-checked from the database). City changes affect public forms → revalidate everything. */
async function admin(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    const r = await fn();
    revalidatePath("/", "layout");
    return r;
  } catch (error) {
    return toActionError(error);
  }
}

const read = (fd: FormData) => locationSchema.safeParse({ name: str(fd, "name"), slug: str(fd, "slug"), sortOrder: str(fd, "sortOrder") || "0" });
const INVALID = "اطلاعات وارد شده معتبر نیست.";

export async function saveProvinceAction(id: string | null, fd: FormData) {
  return admin(async () => {
    if (id !== null && !isUuid(id)) return fail(INVALID);
    const parsed = read(fd);
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    await saveProvince(id, parsed.data);
    return ok(undefined, id ? "استان ویرایش شد." : "استان اضافه شد.");
  });
}

export async function saveCityAction(id: string | null, fd: FormData) {
  return admin(async () => {
    const provinceId = str(fd, "provinceId");
    if ((id !== null && !isUuid(id)) || !isUuid(provinceId)) return fail(INVALID, { provinceId: ["استان را انتخاب کنید."] });
    const parsed = read(fd);
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    await saveCity(id, provinceId, parsed.data);
    return ok(undefined, id ? "شهر ویرایش شد." : "شهر اضافه شد.");
  });
}

export async function setProvinceActiveAction(id: string, isActive: boolean) {
  return admin(async () => {
    if (!isUuid(id)) return fail(INVALID);
    await setProvinceActive(id, isActive);
    return ok(undefined, isActive ? "استان فعال شد." : "استان غیرفعال شد؛ اطلاعات قبلی حفظ می‌شود.");
  });
}

export async function setCityActiveAction(id: string, isActive: boolean) {
  return admin(async () => {
    if (!isUuid(id)) return fail(INVALID);
    await setCityActive(id, isActive);
    return ok(undefined, isActive ? "شهر فعال شد." : "شهر غیرفعال شد؛ اطلاعات قبلی حفظ می‌شود.");
  });
}

export async function deleteCityAction(id: string) {
  return admin(async () => {
    if (!isUuid(id)) return fail(INVALID);
    await deleteCity(id);
    return ok(undefined, "شهر حذف شد.");
  });
}

export async function deleteProvinceAction(id: string) {
  return admin(async () => {
    if (!isUuid(id)) return fail(INVALID);
    await deleteProvince(id);
    return ok(undefined, "استان حذف شد.");
  });
}
