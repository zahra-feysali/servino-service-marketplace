import { ActionButton } from "@/components/shared/action-button";
import type { AppRole } from "@/features/auth/rbac";
import { changeOrderStatusAction } from "@/features/marketplace/actions";
import { TRANSITION_ACTION_LABELS } from "@/features/orders/labels";
import { availableTransitions, type OrderStatus } from "@/features/orders/state-machine";

const CONFIRM_TEXT: Partial<Record<OrderStatus, string>> = {
  ACCEPTED: "با تأیید سفارش، متعهد به انجام کار با قیمت پیشنهادی خود می‌شوید.",
  IN_PROGRESS: "شروع انجام کار را اعلام می‌کنید.",
  PROVIDER_COMPLETED: "اتمام کار را اعلام می‌کنید؛ مشتری باید آن را تأیید کند.",
  COMPLETED: "با تأیید، انجام کامل خدمت را تأیید می‌کنید و سپس می‌توانید نظر ثبت کنید.",
  CANCELLED: "سفارش لغو می‌شود و این عمل قابل بازگشت نیست.",
  DISPUTED: "سفارش به حالت اختلاف می‌رود تا توسط پشتیبانی بررسی شود.",
};

/** Buttons for the transitions the current actor may perform (the server re-validates everything). */
export function OrderActions({ orderId, status, role }: { orderId: string; status: OrderStatus; role: AppRole }) {
  const transitions = availableTransitions(status, role);
  if (transitions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((t) => {
        const destructive = t.to === "CANCELLED" || t.to === "DISPUTED";
        return (
          <ActionButton
            key={t.to}
            action={changeOrderStatusAction.bind(null, orderId, t.to)}
            variant={destructive ? "outline" : "default"}
            confirm={{
              title: `${TRANSITION_ACTION_LABELS[t.to]}؟`,
              description: CONFIRM_TEXT[t.to],
              confirmLabel: TRANSITION_ACTION_LABELS[t.to],
              destructive,
            }}
            note={t.requiresNote ? { label: "توضیح", required: true, placeholder: "دلیل را بنویسید…" } : undefined}
          >
            {TRANSITION_ACTION_LABELS[t.to]}
          </ActionButton>
        );
      })}
    </div>
  );
}
