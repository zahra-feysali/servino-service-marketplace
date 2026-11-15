import { z } from "zod";

/** Support ticket rules (pure). */

export const TICKET_CATEGORIES = ["GENERAL", "ACCOUNT", "ORDER", "PAYMENT", "TECHNICAL", "OTHER"] as const;
export type TicketStatus = "OPEN" | "ANSWERED" | "CUSTOMER_REPLY" | "CLOSED";

export const TICKET_CATEGORY_LABELS: Record<(typeof TICKET_CATEGORIES)[number], string> = {
  GENERAL: "عمومی",
  ACCOUNT: "حساب کاربری",
  ORDER: "سفارش",
  PAYMENT: "پرداخت و اشتراک",
  TECHNICAL: "مشکل فنی",
  OTHER: "سایر",
};

export const TICKET_STATUS_META = {
  OPEN: { label: "باز — در انتظار پاسخ", variant: "secondary" },
  ANSWERED: { label: "پاسخ داده شد", variant: "default" },
  CUSTOMER_REPLY: { label: "پاسخ کاربر — در انتظار پشتیبانی", variant: "secondary" },
  CLOSED: { label: "بسته‌شده", variant: "outline" },
} as const;

/** Status after a new message: staff replies → ANSWERED; user replies → CUSTOMER_REPLY. Closed tickets reopen on user reply. */
export function statusAfterMessage(current: TicketStatus, byStaff: boolean): TicketStatus {
  if (byStaff) return "ANSWERED";
  return current === "OPEN" ? "OPEN" : "CUSTOMER_REPLY";
}

export const ticketCreateSchema = z.object({
  subject: z.string().trim().min(5, "عنوان حداقل ۵ کاراکتر است.").max(200),
  category: z.enum(TICKET_CATEGORIES),
  message: z.string().trim().min(10, "متن پیام حداقل ۱۰ کاراکتر است.").max(5000),
  orderId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
});

export const ticketReplySchema = z.object({
  message: z.string().trim().min(2, "متن پاسخ را بنویسید.").max(5000),
});
