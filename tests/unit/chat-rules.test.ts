import { describe, expect, it } from "vitest";
import { chatSideFor, chatState, conversationPath, messageBodySchema, validateMessageContent } from "@/features/chat/rules";

describe("chat rules", () => {
  it("allows sending only while the offer is live and nothing was cancelled", () => {
    expect(chatState({ offerStatus: "PENDING", requestStatus: "OPEN", orderStatus: null }).canSend).toBe(true);
    expect(chatState({ offerStatus: "ACCEPTED", requestStatus: "PROVIDER_SELECTED", orderStatus: "IN_PROGRESS" }).canSend).toBe(true);
    expect(chatState({ offerStatus: "ACCEPTED", requestStatus: "COMPLETED", orderStatus: "COMPLETED" }).canSend).toBe(true);
    expect(chatState({ offerStatus: "WITHDRAWN", requestStatus: "OPEN", orderStatus: null }).canSend).toBe(false);
    expect(chatState({ offerStatus: "REJECTED", requestStatus: "PROVIDER_SELECTED", orderStatus: null }).canSend).toBe(false);
    expect(chatState({ offerStatus: "PENDING", requestStatus: "CANCELLED", orderStatus: null }).canSend).toBe(false);
    expect(chatState({ offerStatus: "ACCEPTED", requestStatus: "PROVIDER_SELECTED", orderStatus: "CANCELLED" }).canSend).toBe(false);
    expect(chatState({ offerStatus: null, requestStatus: "OPEN", orderStatus: null }).canSend).toBe(false);
  });

  it("requires text or a file and caps file count", () => {
    expect(validateMessageContent(null, 0)).not.toBeNull();
    expect(validateMessageContent("سلام", 0)).toBeNull();
    expect(validateMessageContent(null, 2)).toBeNull();
    expect(validateMessageContent("x", 6)).not.toBeNull();
  });

  it("normalises the message body", () => {
    expect(messageBodySchema.parse("  سلام  ")).toBe("سلام");
    expect(messageBodySchema.parse("   ")).toBeNull();
    expect(messageBodySchema.safeParse("x".repeat(2001)).success).toBe(false);
  });

  it("identifies participants only", () => {
    const conv = { customerId: "c", providerUserId: "p" };
    expect(chatSideFor("c", conv)).toBe("CUSTOMER");
    expect(chatSideFor("p", conv)).toBe("PROVIDER");
    expect(chatSideFor("x", conv)).toBeNull();
    expect(conversationPath("PROVIDER", "id1")).toBe("/dashboard/provider/messages/id1");
  });
});
