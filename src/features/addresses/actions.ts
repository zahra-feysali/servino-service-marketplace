"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { isUuid } from "@/lib/db-locks";
import { bool, num, str } from "@/lib/form-data";
import { addressInputSchema } from "./schemas";
import { createAddress, deleteAddress, updateAddress } from "./service";

const INVALID = "اطلاعات وارد شده معتبر نیست.";

function parse(fd: FormData) {
  return addressInputSchema.safeParse({
    title: str(fd, "title"),
    cityId: str(fd, "cityId"),
    line: str(fd, "line"),
    postalCode: num(fd, "postalCode"),
    isDefault: bool(fd, "isDefault"),
  });
}

/** `id` null = create. Ownership is enforced in the service by the session user id. */
export async function saveAddressAction(id: string | null, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("CUSTOMER");
    if (id !== null && !isUuid(id)) return fail(INVALID);
    const parsed = parse(formData);
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    if (id) await updateAddress(user.id, id, parsed.data);
    else await createAddress(user.id, parsed.data);
    revalidatePath("/dashboard/customer/addresses");
    return ok(undefined, id ? "نشانی به‌روزرسانی شد." : "نشانی اضافه شد.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteAddressAction(id: string): Promise<ActionResult> {
  try {
    const user = await requireRole("CUSTOMER");
    if (!isUuid(id)) return fail(INVALID);
    await deleteAddress(user.id, id);
    revalidatePath("/dashboard/customer/addresses");
    return ok(undefined, "نشانی حذف شد.");
  } catch (e) {
    return toActionError(e);
  }
}
