"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { isUuid } from "@/lib/db-locks";
import { str } from "@/lib/form-data";
import { dashboardPathForRole } from "@/features/auth/rbac";
import { ticketCreateSchema, ticketReplySchema } from "./rules";
import { createTicket, replyToTicket, setTicketClosed } from "./service";

const INVALID = "اطلاعات وارد شده معتبر نیست.";

export async function createTicketAction(formData: FormData): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const user = await requireRole("CUSTOMER", "PROVIDER");
    const parsed = ticketCreateSchema.safeParse({
      subject: str(formData, "subject"),
      category: str(formData, "category"),
      message: str(formData, "message"),
      orderId: str(formData, "orderId"),
    });
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    const ticket = await createTicket(user, parsed.data);
    return ok({ redirectTo: `${dashboardPathForRole(user.role)}/tickets/${ticket.id}` }, `تیکت ${ticket.code} ثبت شد.`);
  } catch (e) {
    return toActionError(e);
  }
}

/** Used by customers, providers (own tickets) and admins (any ticket). */
export async function replyTicketAction(ticketId: string, formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("CUSTOMER", "PROVIDER", "ADMIN");
    if (!isUuid(ticketId)) return fail(INVALID);
    const parsed = ticketReplySchema.safeParse({ message: str(formData, "message") });
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    await replyToTicket(user, ticketId, parsed.data.message);
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "پاسخ ارسال شد.");
  } catch (e) {
    return toActionError(e);
  }
}

export async function setTicketClosedAction(ticketId: string, closed: boolean): Promise<ActionResult> {
  try {
    const user = await requireRole("CUSTOMER", "PROVIDER", "ADMIN");
    if (!isUuid(ticketId) || typeof closed !== "boolean") return fail(INVALID);
    await setTicketClosed(user, ticketId, closed);
    revalidatePath("/dashboard", "layout");
    return ok(undefined, closed ? "تیکت بسته شد." : "تیکت دوباره باز شد.");
  } catch (e) {
    return toActionError(e);
  }
}
