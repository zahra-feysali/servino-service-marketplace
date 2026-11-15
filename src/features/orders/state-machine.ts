import type { AppRole } from "@/features/auth/rbac";

/**
 * Order lifecycle (pure). Every transition declares which actor may perform it.
 * - CUSTOMER / PROVIDER may only act on orders they own (checked by the service).
 * - ADMIN may resolve disputes and cancel.
 */

export const ORDER_STATUSES = [
  "PENDING_PROVIDER_CONFIRMATION",
  "ACCEPTED",
  "IN_PROGRESS",
  "PROVIDER_COMPLETED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

type Transition = { to: OrderStatus; actors: readonly AppRole[]; requiresNote?: boolean };

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly Transition[]> = {
  PENDING_PROVIDER_CONFIRMATION: [
    { to: "ACCEPTED", actors: ["PROVIDER"] },
    { to: "CANCELLED", actors: ["CUSTOMER", "PROVIDER", "ADMIN"], requiresNote: true },
  ],
  ACCEPTED: [
    { to: "IN_PROGRESS", actors: ["PROVIDER"] },
    { to: "CANCELLED", actors: ["CUSTOMER", "PROVIDER", "ADMIN"], requiresNote: true },
  ],
  IN_PROGRESS: [
    { to: "PROVIDER_COMPLETED", actors: ["PROVIDER"] },
    { to: "DISPUTED", actors: ["CUSTOMER", "PROVIDER", "ADMIN"], requiresNote: true },
  ],
  PROVIDER_COMPLETED: [
    { to: "COMPLETED", actors: ["CUSTOMER", "ADMIN"] },
    { to: "DISPUTED", actors: ["CUSTOMER", "ADMIN"], requiresNote: true },
  ],
  DISPUTED: [
    { to: "COMPLETED", actors: ["ADMIN"], requiresNote: true },
    { to: "CANCELLED", actors: ["ADMIN"], requiresNote: true },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ["COMPLETED", "CANCELLED"];
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING_PROVIDER_CONFIRMATION",
  "ACCEPTED",
  "IN_PROGRESS",
  "PROVIDER_COMPLETED",
];

export function findTransition(from: OrderStatus, to: OrderStatus): Transition | null {
  return ORDER_TRANSITIONS[from].find((t) => t.to === to) ?? null;
}

export type TransitionCheck =
  | { ok: true; requiresNote: boolean }
  | { ok: false; reason: "INVALID_TRANSITION" | "ACTOR_NOT_ALLOWED" | "NOTE_REQUIRED" };

export function checkTransition(from: OrderStatus, to: OrderStatus, actor: AppRole, note?: string | null): TransitionCheck {
  const t = findTransition(from, to);
  if (!t) return { ok: false, reason: "INVALID_TRANSITION" };
  if (!t.actors.includes(actor)) return { ok: false, reason: "ACTOR_NOT_ALLOWED" };
  if (t.requiresNote && !note?.trim()) return { ok: false, reason: "NOTE_REQUIRED" };
  return { ok: true, requiresNote: !!t.requiresNote };
}

/** Transitions available to an actor in the given state (used to render action buttons). */
export function availableTransitions(from: OrderStatus, actor: AppRole): Transition[] {
  return ORDER_TRANSITIONS[from].filter((t) => t.actors.includes(actor));
}

/** Timestamp column to set when entering a status. */
export function timestampFieldFor(to: OrderStatus) {
  switch (to) {
    case "ACCEPTED":
      return "providerConfirmedAt" as const;
    case "IN_PROGRESS":
      return "startedAt" as const;
    case "PROVIDER_COMPLETED":
      return "providerCompletedAt" as const;
    case "COMPLETED":
      return "completedAt" as const;
    case "CANCELLED":
      return "cancelledAt" as const;
    default:
      return null;
  }
}
