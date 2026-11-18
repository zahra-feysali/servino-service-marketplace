import { describe, expect, it } from "vitest";
import {
  MAX_WITHDRAWAL,
  WITHDRAWAL_STATUS_META,
  availableBalance,
  bankAccountSchema,
  bankNameFromSheba,
  canApplyWithdrawalAction,
  formatSheba,
  isReserving,
  isValidSheba,
  markPaidSchema,
  maskSheba,
  minWithdrawalSchema,
  normalizeSheba,
  rejectReasonSchema,
  withdrawalAmountSchema,
  withdrawalRequestSchema,
} from "@/features/withdrawals/rules";
import { WALLET_REASON_LABELS } from "@/features/payments/rules";
import { formatPrice } from "@/lib/utils";

const MELLI = "IR050170000000123456789012"; // valid checksum, bank code 017
const MELLAT = "IR360120000000000987654321"; // valid checksum, bank code 012
const WIKI = "IR062960000000100324200001"; // ISO 13616 example, unknown bank code

describe("Sheba (IBAN) validation", () => {
  it("accepts valid Iranian IBANs (mod-97 checksum)", () => {
    expect(isValidSheba(MELLI)).toBe(true);
    expect(isValidSheba(MELLAT)).toBe(true);
    expect(isValidSheba(WIKI)).toBe(true);
  });

  it("rejects wrong checksums, lengths and countries", () => {
    expect(isValidSheba("IR050170000000123456789013")).toBe(false); // last digit changed
    expect(isValidSheba("IR060170000000123456789012")).toBe(false); // check digits changed
    expect(isValidSheba("IR05017000000012345678901")).toBe(false); // 23 digits
    expect(isValidSheba("DE89370400440532013000")).toBe(false);
    expect(isValidSheba("")).toBe(false);
  });

  it("normalizes spaces, dashes, Persian digits, lower case and a missing IR prefix", () => {
    expect(normalizeSheba("ir05 0170 0000 0012 3456 7890 12")).toBe(MELLI);
    expect(normalizeSheba("IR05-0170-0000-0012-3456-7890-12")).toBe(MELLI);
    expect(normalizeSheba("IR۰۵۰۱۷۰۰۰۰۰۰۰۱۲۳۴۵۶۷۸۹۰۱۲")).toBe(MELLI);
    expect(normalizeSheba("050170000000123456789012")).toBe(MELLI);
  });

  it("validates through the bank account schema and stores the normalized value", () => {
    const ok = bankAccountSchema.safeParse({ holderName: "  علی رضایی  ", iban: "ir05 0170 0000 0012 3456 7890 12" });
    expect(ok.success && ok.data).toEqual({ holderName: "علی رضایی", iban: MELLI });
    expect(bankAccountSchema.safeParse({ holderName: "علی رضایی", iban: "IR050170000000123456789013" }).success).toBe(false);
    expect(bankAccountSchema.safeParse({ holderName: "ع", iban: MELLI }).success).toBe(false);
  });

  it("masks and formats for display", () => {
    expect(maskSheba(MELLI)).toBe("IR•• •••• … 9012");
    expect(maskSheba(MELLI)).not.toContain("12345678");
    expect(formatSheba(MELLI)).toBe("IR05 0170 0000 0012 3456 7890 12");
    expect(bankNameFromSheba(MELLI)).toBe("بانک ملی ایران");
    expect(bankNameFromSheba(MELLAT)).toBe("بانک ملت");
    expect(bankNameFromSheba(WIKI)).toBeNull();
  });
});

describe("withdrawal amount validation", () => {
  const parse = (v: unknown) => withdrawalAmountSchema.safeParse(v);

  it("accepts positive integer Toman in Latin or Persian digits with separators", () => {
    expect(parse("1500000").data).toBe(1_500_000);
    expect(parse("1,500,000").data).toBe(1_500_000);
    expect(parse("۱٬۵۰۰٬۰۰۰").data).toBe(1_500_000);
    expect(parse(String(MAX_WITHDRAWAL)).data).toBe(MAX_WITHDRAWAL);
  });

  it("rejects zero, negative, fractional, malformed, empty and excessive values", () => {
    for (const bad of ["0", "-5000", "1500.5", "12abc", "", "1e6", String(MAX_WITHDRAWAL + 1), "99999999999999999999"]) {
      expect(parse(bad).success, bad).toBe(false);
    }
  });

  it("requires a UUID idempotency key with the request", () => {
    expect(withdrawalRequestSchema.safeParse({ amount: "1000", clientKey: "not-a-uuid" }).success).toBe(false);
    expect(withdrawalRequestSchema.safeParse({ amount: "1000", clientKey: "3f1f2f8e-4c2a-4b7e-9a51-0d2c1f9b8a77" }).success).toBe(true);
  });

  it("validates admin inputs (payout reference, rejection reason, minimum)", () => {
    expect(markPaidSchema.safeParse({ reference: " ۱۲۳۴۵۶۷۸ ", note: "" }).data).toEqual({ reference: "12345678", note: null });
    expect(markPaidSchema.safeParse({ reference: "12", note: "" }).success).toBe(false);
    expect(markPaidSchema.safeParse({ reference: "abc<script>", note: "" }).success).toBe(false);
    expect(rejectReasonSchema.safeParse("   ").success).toBe(false);
    expect(rejectReasonSchema.safeParse("شبا به نام متخصص نیست").success).toBe(true);
    expect(minWithdrawalSchema.safeParse({ minAmount: "50,000" }).data).toEqual({ minAmount: 50_000 });
    expect(minWithdrawalSchema.safeParse({ minAmount: "-1" }).success).toBe(false);
  });
});

describe("withdrawal status transitions", () => {
  it("allows only the documented transitions", () => {
    expect(canApplyWithdrawalAction("PENDING", "APPROVE")).toBe(true);
    expect(canApplyWithdrawalAction("PENDING", "REJECT")).toBe(true);
    expect(canApplyWithdrawalAction("PENDING", "CANCEL")).toBe(true);
    expect(canApplyWithdrawalAction("PENDING", "PAY")).toBe(false); // must be approved first

    expect(canApplyWithdrawalAction("APPROVED", "PAY")).toBe(true);
    expect(canApplyWithdrawalAction("APPROVED", "REJECT")).toBe(true);
    expect(canApplyWithdrawalAction("APPROVED", "CANCEL")).toBe(false); // provider cannot cancel after approval
    expect(canApplyWithdrawalAction("APPROVED", "APPROVE")).toBe(false);

    for (const terminal of ["PAID", "REJECTED", "CANCELLED"] as const) {
      for (const action of ["APPROVE", "REJECT", "PAY", "CANCEL"] as const) {
        expect(canApplyWithdrawalAction(terminal, action), `${terminal}/${action}`).toBe(false);
      }
    }
  });

  it("reserves funds only while pending or approved", () => {
    expect(isReserving("PENDING")).toBe(true);
    expect(isReserving("APPROVED")).toBe(true);
    expect(isReserving("PAID")).toBe(false);
    expect(isReserving("REJECTED")).toBe(false);
    expect(isReserving("CANCELLED")).toBe(false);
  });

  it("has Persian labels for every status and the ledger reason", () => {
    expect(WITHDRAWAL_STATUS_META.PENDING.label).toBe("در انتظار بررسی");
    expect(WITHDRAWAL_STATUS_META.PAID.label).toBe("پرداخت شده");
    expect(WALLET_REASON_LABELS.WITHDRAWAL).toContain("برداشت");
  });
});

describe("balances", () => {
  it("available = balance − reserved, never negative", () => {
    expect(availableBalance(1_000_000, 0)).toBe(1_000_000);
    expect(availableBalance(1_000_000, 400_000)).toBe(600_000);
    expect(availableBalance(400_000, 400_000)).toBe(0);
    expect(availableBalance(0, 0)).toBe(0);
  });

  it("formats Toman amounts in Persian", () => {
    expect(formatPrice(1_500_000)).toContain("۱٬۵۰۰٬۰۰۰");
  });
});
