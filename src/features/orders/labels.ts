import type { OrderStatus } from "./state-machine";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  PENDING_PROVIDER_CONFIRMATION: { label: "در انتظار تأیید متخصص", variant: "outline" },
  ACCEPTED: { label: "تأییدشده توسط متخصص", variant: "secondary" },
  IN_PROGRESS: { label: "در حال انجام", variant: "secondary" },
  PROVIDER_COMPLETED: { label: "انجام شد (منتظر تأیید مشتری)", variant: "default" },
  COMPLETED: { label: "تکمیل‌شده", variant: "default" },
  CANCELLED: { label: "لغوشده", variant: "destructive" },
  DISPUTED: { label: "دارای اختلاف", variant: "destructive" },
};

/** Button labels for transitions, from the actor's point of view. */
export const TRANSITION_ACTION_LABELS: Record<OrderStatus, string> = {
  PENDING_PROVIDER_CONFIRMATION: "",
  ACCEPTED: "تأیید سفارش",
  IN_PROGRESS: "شروع کار",
  PROVIDER_COMPLETED: "اعلام اتمام کار",
  COMPLETED: "تأیید انجام کار",
  CANCELLED: "لغو سفارش",
  DISPUTED: "ثبت اختلاف",
};
