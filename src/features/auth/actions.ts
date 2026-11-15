"use server";

import { z } from "zod";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { getCurrentUser } from "@/lib/authz";
import { registerSchema, type RegisterInput } from "./schemas";
import { registerUser } from "./service";
import type { AppRole } from "./rbac";

/**
 * Public registration (CUSTOMER or PROVIDER only — the schema rejects ADMIN).
 * The client signs in with the same credentials after success.
 */
export async function registerAction(input: RegisterInput): Promise<ActionResult<{ role: AppRole }>> {
  try {
    if (await getCurrentUser()) {
      return fail("شما در حال حاضر وارد حساب کاربری هستید.");
    }

    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) {
      return fail("اطلاعات وارد شده معتبر نیست.", z.flattenError(parsed.error).fieldErrors);
    }

    const user = await registerUser(parsed.data);
    return ok({ role: user.role }, "ثبت‌نام با موفقیت انجام شد.");
  } catch (error) {
    return toActionError(error);
  }
}
