"use server";

import { requireUser } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { startConversation } from "./service";

/**
 * Opens (or reuses) the chat for a request. Customers pass the offering provider's profile id;
 * providers chat about their own offer. Ownership and the offer requirement are checked in the service.
 */
export async function startConversationAction(requestId: string, providerId?: string): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    if (!isUuid(requestId) || (providerId !== undefined && !isUuid(providerId))) return fail("گفتگو یافت نشد.");
    const user = await requireUser();
    const r = await startConversation(user, requestId, providerId);
    return ok({ redirectTo: r.path });
  } catch (error) {
    return toActionError(error);
  }
}
