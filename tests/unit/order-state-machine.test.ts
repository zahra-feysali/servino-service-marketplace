import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  availableTransitions,
  checkTransition,
  timestampFieldFor,
} from "@/features/orders/state-machine";

describe("order state machine", () => {
  it("allows the happy path with the right actors", () => {
    expect(checkTransition("PENDING_PROVIDER_CONFIRMATION", "ACCEPTED", "PROVIDER").ok).toBe(true);
    expect(checkTransition("ACCEPTED", "IN_PROGRESS", "PROVIDER").ok).toBe(true);
    expect(checkTransition("IN_PROGRESS", "PROVIDER_COMPLETED", "PROVIDER").ok).toBe(true);
    expect(checkTransition("PROVIDER_COMPLETED", "COMPLETED", "CUSTOMER").ok).toBe(true);
  });

  it("prevents customers from performing provider steps and vice versa", () => {
    expect(checkTransition("PENDING_PROVIDER_CONFIRMATION", "ACCEPTED", "CUSTOMER")).toEqual({ ok: false, reason: "ACTOR_NOT_ALLOWED" });
    expect(checkTransition("IN_PROGRESS", "PROVIDER_COMPLETED", "CUSTOMER")).toEqual({ ok: false, reason: "ACTOR_NOT_ALLOWED" });
    expect(checkTransition("PROVIDER_COMPLETED", "COMPLETED", "PROVIDER")).toEqual({ ok: false, reason: "ACTOR_NOT_ALLOWED" });
  });

  it("rejects skipping states and leaving terminal states", () => {
    expect(checkTransition("PENDING_PROVIDER_CONFIRMATION", "COMPLETED", "ADMIN")).toEqual({ ok: false, reason: "INVALID_TRANSITION" });
    expect(checkTransition("ACCEPTED", "PROVIDER_COMPLETED", "PROVIDER")).toEqual({ ok: false, reason: "INVALID_TRANSITION" });
    for (const to of ORDER_STATUSES) {
      expect(checkTransition("COMPLETED", to, "ADMIN").ok).toBe(false);
      expect(checkTransition("CANCELLED", to, "ADMIN").ok).toBe(false);
    }
  });

  it("requires a note for cancellations and disputes", () => {
    expect(checkTransition("ACCEPTED", "CANCELLED", "CUSTOMER")).toEqual({ ok: false, reason: "NOTE_REQUIRED" });
    expect(checkTransition("ACCEPTED", "CANCELLED", "CUSTOMER", "   ")).toEqual({ ok: false, reason: "NOTE_REQUIRED" });
    expect(checkTransition("ACCEPTED", "CANCELLED", "CUSTOMER", "تغییر برنامه").ok).toBe(true);
    expect(checkTransition("PROVIDER_COMPLETED", "DISPUTED", "CUSTOMER", "کار ناقص").ok).toBe(true);
  });

  it("lets only admins resolve disputes", () => {
    expect(checkTransition("DISPUTED", "COMPLETED", "CUSTOMER", "x").ok).toBe(false);
    expect(checkTransition("DISPUTED", "COMPLETED", "ADMIN", "بررسی شد").ok).toBe(true);
    expect(checkTransition("DISPUTED", "CANCELLED", "ADMIN", "بررسی شد").ok).toBe(true);
  });

  it("does not let customers cancel once work is in progress", () => {
    expect(checkTransition("IN_PROGRESS", "CANCELLED", "CUSTOMER", "x").ok).toBe(false);
  });

  it("lists available actions per actor", () => {
    expect(availableTransitions("PENDING_PROVIDER_CONFIRMATION", "PROVIDER").map((t) => t.to)).toEqual(["ACCEPTED", "CANCELLED"]);
    expect(availableTransitions("PENDING_PROVIDER_CONFIRMATION", "CUSTOMER").map((t) => t.to)).toEqual(["CANCELLED"]);
    expect(availableTransitions("COMPLETED", "ADMIN")).toEqual([]);
  });

  it("defines a transition list for every status and timestamp columns", () => {
    for (const s of ORDER_STATUSES) expect(ORDER_TRANSITIONS[s]).toBeDefined();
    expect(timestampFieldFor("ACCEPTED")).toBe("providerConfirmedAt");
    expect(timestampFieldFor("COMPLETED")).toBe("completedAt");
    expect(timestampFieldFor("DISPUTED")).toBeNull();
  });
});
