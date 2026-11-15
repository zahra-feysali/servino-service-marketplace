"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { isUuid } from "@/lib/db-locks";
import { offerInputSchema, type OfferInput } from "@/features/offers/rules";
import { selectOffer, submitOffer, withdrawOffer } from "@/features/offers/service";
import { changeOrderStatus } from "@/features/orders/service";
import { ORDER_STATUSES, type OrderStatus } from "@/features/orders/state-machine";
import { cancelRequestSchema } from "@/features/requests/schemas";
import { cancelServiceRequest } from "@/features/requests/service";
import { reviewInputSchema, type ReviewInput } from "@/features/reviews/rules";
import { submitReview } from "@/features/reviews/service";

/**
 * Marketplace workflow actions. Each one: authenticate → role → validate ids/input →
 * service (which enforces ownership + state inside a transaction) → revalidate.
 * Ids of the acting user always come from the server session, never from the client.
 */

const NOT_FOUND = "مورد درخواستی یافت نشد.";
const INVALID = "اطلاعات وارد شده معتبر نیست.";

// ── Customer ────────────────────────────────────────────────────────────────

export async function selectOfferAction(requestId: string, offerId: string): Promise<ActionResult<{ orderId: string }>> {
  try {
    const user = await requireRole("CUSTOMER");
    if (!isUuid(requestId) || !isUuid(offerId)) return fail(NOT_FOUND);
    const order = await selectOffer(user.id, requestId, offerId);
    revalidatePath("/dashboard/customer", "layout");
    return ok({ orderId: order.id }, `متخصص انتخاب شد و سفارش ${order.code} ایجاد شد.`);
  } catch (error) {
    return toActionError(error);
  }
}

export async function cancelRequestAction(requestId: string, reason?: string): Promise<ActionResult> {
  try {
    const user = await requireRole("CUSTOMER");
    if (!isUuid(requestId)) return fail(NOT_FOUND);
    const parsed = cancelRequestSchema.safeParse({ reason: typeof reason === "string" ? reason : "" });
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    await cancelServiceRequest(user.id, requestId, parsed.data.reason);
    revalidatePath("/dashboard/customer", "layout");
    return ok(undefined, "درخواست لغو شد.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function submitReviewAction(orderId: string, input: ReviewInput): Promise<ActionResult> {
  try {
    const user = await requireRole("CUSTOMER");
    if (!isUuid(orderId)) return fail(NOT_FOUND);
    const parsed = reviewInputSchema.safeParse(input);
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    await submitReview(user.id, orderId, parsed.data);
    revalidatePath("/dashboard/customer", "layout");
    return ok(undefined, "نظر شما ثبت شد. سپاسگزاریم!");
  } catch (error) {
    return toActionError(error);
  }
}

// ── Provider ────────────────────────────────────────────────────────────────

export async function submitOfferAction(requestId: string, input: OfferInput): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    if (!isUuid(requestId)) return fail(NOT_FOUND);
    const parsed = offerInputSchema.safeParse(input);
    if (!parsed.success) return fail(INVALID, z.flattenError(parsed.error).fieldErrors);
    await submitOffer(user.id, requestId, parsed.data);
    revalidatePath("/dashboard/provider", "layout");
    return ok(undefined, "پیشنهاد شما ارسال شد.");
  } catch (error) {
    return toActionError(error);
  }
}

export async function withdrawOfferAction(offerId: string): Promise<ActionResult> {
  try {
    const user = await requireRole("PROVIDER");
    if (!isUuid(offerId)) return fail(NOT_FOUND);
    await withdrawOffer(user.id, offerId);
    revalidatePath("/dashboard/provider", "layout");
    return ok(undefined, "پیشنهاد پس گرفته شد.");
  } catch (error) {
    return toActionError(error);
  }
}

// ── Orders (customer, provider, admin) ───────────────────────────────────────

export async function changeOrderStatusAction(orderId: string, to: OrderStatus, note?: string): Promise<ActionResult> {
  try {
    const user = await requireRole("CUSTOMER", "PROVIDER", "ADMIN");
    if (!isUuid(orderId) || !(ORDER_STATUSES as readonly string[]).includes(to)) return fail(NOT_FOUND);
    const cleanNote = typeof note === "string" ? note.trim().slice(0, 1000) : undefined;
    await changeOrderStatus(user, orderId, to, cleanNote);
    revalidatePath("/dashboard", "layout");
    return ok(undefined, "وضعیت سفارش به‌روزرسانی شد.");
  } catch (error) {
    return toActionError(error);
  }
}
