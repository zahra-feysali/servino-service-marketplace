import { z } from "zod";
import type { UploadableMime } from "@/features/forms/definitions";

/**
 * Customer ↔ provider chat rules (pure).
 * A conversation belongs to one request + one provider and exists only once that provider has
 * sent an offer on the request. It stays readable forever; sending is allowed while the offer is
 * live (pending/accepted) and the request/order has not been cancelled.
 */

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_CHAT_FILES = 5;
export const CHAT_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const CHAT_MIME_TYPES: UploadableMime[] = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const CHAT_POLL_INTERVAL_MS = 4000;
export const CHAT_PAGE_SIZE = 50;

export const messageBodySchema = z
  .string()
  .trim()
  .max(MAX_MESSAGE_LENGTH, `حداکثر ${MAX_MESSAGE_LENGTH.toLocaleString("fa-IR")} نویسه مجاز است.`)
  .transform((v) => (v === "" ? null : v));

export type ChatContext = {
  offerStatus: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | null;
  requestStatus: string;
  orderStatus: string | null;
};

export type ChatState = { canSend: true } | { canSend: false; reason: string };

export function chatState(ctx: ChatContext): ChatState {
  if (ctx.orderStatus === "CANCELLED") return { canSend: false, reason: "این سفارش لغو شده است؛ گفتگو فقط قابل مشاهده است." };
  if (ctx.requestStatus === "CANCELLED") return { canSend: false, reason: "این درخواست لغو شده است؛ گفتگو فقط قابل مشاهده است." };
  if (ctx.offerStatus !== "PENDING" && ctx.offerStatus !== "ACCEPTED") {
    return { canSend: false, reason: "پیشنهاد این متخصص دیگر فعال نیست؛ گفتگو فقط قابل مشاهده است." };
  }
  return { canSend: true };
}

/** A message must carry text or at least one file. */
export function validateMessageContent(body: string | null, fileCount: number): string | null {
  if (!body && fileCount === 0) return "متن پیام یا یک فایل لازم است.";
  if (fileCount > MAX_CHAT_FILES) return `حداکثر ${MAX_CHAT_FILES.toLocaleString("fa-IR")} فایل در هر پیام مجاز است.`;
  return null;
}

export type ChatSide = "CUSTOMER" | "PROVIDER";

/** Which side of the conversation the user is on, or null when they are not a participant. */
export function chatSideFor(userId: string, conv: { customerId: string; providerUserId: string }): ChatSide | null {
  if (conv.customerId === userId) return "CUSTOMER";
  if (conv.providerUserId === userId) return "PROVIDER";
  return null;
}

export function conversationPath(side: ChatSide, id: string) {
  return `/dashboard/${side === "CUSTOMER" ? "customer" : "provider"}/messages/${id}`;
}
