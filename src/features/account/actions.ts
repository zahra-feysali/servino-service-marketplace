"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from "@/features/auth/schemas";
import { changePassword, updateProfile } from "./service";
import { removeAvatar } from "@/features/avatars/service";

/** Users can only edit their own account — the target id always comes from the session. */
export async function updateProfileAction(input: UpdateProfileInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = updateProfileSchema.safeParse(input);
    if (!parsed.success) {
      return fail("اطلاعات وارد شده معتبر نیست.", z.flattenError(parsed.error).fieldErrors);
    }
    await updateProfile(user.id, parsed.data);
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "اطلاعات حساب به‌روزرسانی شد.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function changePasswordAction(input: ChangePasswordInput): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return fail("اطلاعات وارد شده معتبر نیست.", z.flattenError(parsed.error).fieldErrors);
    }
    await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
    return ok(undefined, "رمز عبور با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.");
  } catch (error) {
    return toActionError(error);
  }
}

/** Removes the signed-in user's own profile picture (the default avatar is shown afterwards). */
export async function removeAvatarAction(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await removeAvatar(user.id);
    revalidatePath("/", "layout");
    return ok(undefined, "تصویر پروفایل حذف شد.");
  } catch (error) {
    return toActionError(error);
  }
}
