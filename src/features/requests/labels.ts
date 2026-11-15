import type { OfferStatus, RequestStatus } from "@/generated/prisma/enums";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: "در انتظار پیشنهاد", variant: "secondary" },
  PROVIDER_SELECTED: { label: "متخصص انتخاب شد", variant: "default" },
  COMPLETED: { label: "تکمیل‌شده", variant: "default" },
  CANCELLED: { label: "لغوشده", variant: "destructive" },
  EXPIRED: { label: "منقضی‌شده", variant: "outline" },
};

export const OFFER_STATUS_META: Record<OfferStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: "در انتظار انتخاب مشتری", variant: "secondary" },
  ACCEPTED: { label: "پذیرفته‌شده", variant: "default" },
  REJECTED: { label: "انتخاب نشد", variant: "outline" },
  WITHDRAWN: { label: "پس گرفته شد", variant: "outline" },
};

export const DURATION_UNIT_LABELS = { HOUR: "ساعت", DAY: "روز" } as const;

/** Displays OPEN requests past their expiry as expired (expiry is evaluated lazily). */
export function effectiveRequestStatus(r: { status: RequestStatus; expiresAt: Date | null }, now = new Date()): RequestStatus {
  return r.status === "OPEN" && r.expiresAt && r.expiresAt <= now ? "EXPIRED" : r.status;
}
