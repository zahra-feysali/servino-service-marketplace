"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authz";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { isUuid } from "@/lib/db-locks";
import { markAllRead, markRead } from "./service";

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (!isUuid(notificationId)) return fail("اعلان یافت نشد.");
    await markRead(user.id, notificationId);
    revalidatePath("/dashboard", "layout");
    return ok(undefined);
  } catch (error) {
    return toActionError(error);
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const count = await markAllRead(user.id);
    revalidatePath("/dashboard", "layout");
    return ok(undefined, count > 0 ? "همه اعلان‌ها خوانده شدند." : "اعلان خوانده‌نشده‌ای وجود ندارد.");
  } catch (error) {
    return toActionError(error);
  }
}
