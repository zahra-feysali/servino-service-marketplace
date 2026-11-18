import { z } from "zod";
import { toEnglishDigits } from "@/lib/utils";

/**
 * Pure withdrawal rules (no I/O): Sheba (Iranian IBAN) validation, amount validation, status
 * transitions and balance math. Money is integer Toman.
 *
 * There is no bank API: a withdrawal is paid by an admin with a manual bank transfer outside the
 * application, and the admin then records it here. Nothing in this module moves real money.
 */

// ── Balances ────────────────────────────────────────────────────────────────

/** Spendable/withdrawable part of a wallet: total balance minus funds reserved by open withdrawals. */
export function availableBalance(balance: number, reservedBalance: number): number {
  return Math.max(0, balance - reservedBalance);
}

// ── Sheba (IBAN) ─────────────────────────────────────────────────────────────

export const SHEBA_REGEX = /^IR\d{24}$/;

/** Normalizes user input: Persian/Arabic digits → Latin, removes spaces/dashes, upper-cases, adds "IR". */
export function normalizeSheba(input: string): string {
  const compact = toEnglishDigits(input)
    .replace(/[\s\-_.‌]/g, "")
    .toUpperCase();
  return /^\d{24}$/.test(compact) ? `IR${compact}` : compact;
}

/** ISO 13616 mod-97 check (letters → numbers, first four characters moved to the end). */
export function isValidSheba(value: string): boolean {
  if (!SHEBA_REGEX.test(value)) return false;
  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

/** Bank identifiers (Sheba layout IRkk bbb…: three digits after the check digits) for common Iranian banks. Unknown → null. */
const BANK_NAMES: Record<string, string> = {
  "012": "بانک ملت",
  "013": "بانک رفاه کارگران",
  "014": "بانک مسکن",
  "015": "بانک سپه",
  "016": "بانک کشاورزی",
  "017": "بانک ملی ایران",
  "018": "بانک تجارت",
  "019": "بانک صادرات ایران",
  "021": "پست بانک ایران",
  "054": "بانک پارسیان",
  "055": "بانک اقتصاد نوین",
  "056": "بانک سامان",
  "057": "بانک پاسارگاد",
  "061": "بانک شهر",
  "062": "بانک آینده",
};

export function bankNameFromSheba(sheba: string): string | null {
  if (!SHEBA_REGEX.test(sheba)) return null;
  return BANK_NAMES[sheba.slice(4, 7)] ?? null;
}

/** Full Sheba in groups of four (admin and owner only). */
export function formatSheba(sheba: string): string {
  return sheba.replace(/(.{4})/g, "$1 ").trim();
}

/** Masked Sheba for lists and notifications: keeps the country code and the last four digits. */
export function maskSheba(sheba: string): string {
  if (sheba.length < 8) return "IR••";
  return `IR•• •••• … ${sheba.slice(-4)}`;
}

// ── Input schemas ───────────────────────────────────────────────────────────

/** Upper bound for a single withdrawal (fits a 32-bit Int with a wide margin). */
export const MAX_WITHDRAWAL = 1_000_000_000;

export const bankAccountSchema = z.object({
  holderName: z
    .string()
    .trim()
    .min(3, "نام صاحب حساب را کامل وارد کنید.")
    .max(120, "نام صاحب حساب بیش از حد طولانی است."),
  iban: z
    .string()
    .transform(normalizeSheba)
    .refine((v) => SHEBA_REGEX.test(v), "شماره شبا باید با IR شروع شود و ۲۴ رقم داشته باشد.")
    .refine(isValidSheba, "شماره شبا معتبر نیست؛ ارقام را دوباره بررسی کنید."),
});
export type BankAccountInput = z.output<typeof bankAccountSchema>;

/** Accepts "1,500,000", "۱٬۵۰۰٬۰۰۰" etc. Rejects zero, negative, fractional and malformed values. */
export const withdrawalAmountSchema = z.preprocess(
  (v) => {
    if (typeof v !== "string") return v;
    const cleaned = toEnglishDigits(v).replace(/[,\s٬،]/g, "");
    return cleaned === "" ? undefined : /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN;
  },
  z
    .number({ error: "مبلغ را به عدد و به تومان وارد کنید." })
    .int("مبلغ باید عدد صحیح (تومان) باشد.")
    .positive("مبلغ باید بیشتر از صفر باشد.")
    .max(MAX_WITHDRAWAL, "مبلغ بیش از حد مجاز است."),
);

export const withdrawalRequestSchema = z.object({
  amount: withdrawalAmountSchema,
  clientKey: z.uuid("درخواست نامعتبر است؛ صفحه را دوباره بارگذاری کنید."),
});

export const markPaidSchema = z.object({
  reference: z
    .string()
    .transform((v) => toEnglishDigits(v).trim())
    .pipe(
      z
        .string()
        .min(4, "کد پیگیری انتقال را وارد کنید.")
        .max(64, "کد پیگیری بیش از حد طولانی است.")
        .regex(/^[A-Za-z0-9\-_/]+$/, "کد پیگیری فقط شامل حروف انگلیسی، عدد و خط تیره است."),
    ),
  note: z
    .string()
    .trim()
    .max(1000, "یادداشت حداکثر ۱۰۰۰ نویسه است.")
    .transform((v) => (v === "" ? null : v)),
});

export const rejectReasonSchema = z.string().trim().min(5, "دلیل رد را بنویسید (حداقل ۵ نویسه).").max(1000, "دلیل رد حداکثر ۱۰۰۰ نویسه است.");

/** Admin-configurable minimum (0 = no minimum beyond "more than zero"). */
export const minWithdrawalSchema = z.object({
  minAmount: z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? NaN : Number(toEnglishDigits(v).replace(/[,\s٬]/g, ""))) : v),
    z.number({ error: "مبلغ را وارد کنید." }).int("عدد صحیح وارد کنید.").min(0, "حداقل ۰").max(MAX_WITHDRAWAL, "بیش از حد مجاز"),
  ),
});

// ── Status machine ──────────────────────────────────────────────────────────

export type WithdrawalStatusValue = "PENDING" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
export type WithdrawalAction = "APPROVE" | "REJECT" | "PAY" | "CANCEL";

/** Allowed source statuses per action. Terminal: PAID, REJECTED, CANCELLED. */
export const WITHDRAWAL_TRANSITIONS: Record<WithdrawalAction, { from: WithdrawalStatusValue[]; to: WithdrawalStatusValue }> = {
  APPROVE: { from: ["PENDING"], to: "APPROVED" },
  // An approved request may still be rejected (e.g. the bank transfer could not be made) — never after payment.
  REJECT: { from: ["PENDING", "APPROVED"], to: "REJECTED" },
  PAY: { from: ["APPROVED"], to: "PAID" },
  CANCEL: { from: ["PENDING"], to: "CANCELLED" },
};

export function canApplyWithdrawalAction(status: WithdrawalStatusValue, action: WithdrawalAction): boolean {
  return WITHDRAWAL_TRANSITIONS[action].from.includes(status);
}

/** Statuses whose amount is still reserved on the wallet. */
export const RESERVING_STATUSES: WithdrawalStatusValue[] = ["PENDING", "APPROVED"];
export const isReserving = (status: WithdrawalStatusValue) => RESERVING_STATUSES.includes(status);

export const WITHDRAWAL_ACTION_ERRORS: Record<WithdrawalAction, string> = {
  APPROVE: "فقط درخواست‌های در انتظار بررسی قابل تأیید هستند.",
  REJECT: "این درخواست دیگر قابل رد نیست (پرداخت، رد یا لغو شده است).",
  PAY: "فقط درخواست‌های تأییدشده و پرداخت‌نشده را می‌توان پرداخت‌شده ثبت کرد.",
  CANCEL: "فقط درخواست‌های در انتظار بررسی (پیش از تأیید مدیر) قابل لغو هستند.",
};

export const WITHDRAWAL_STATUS_META: Record<WithdrawalStatusValue, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  PENDING: { label: "در انتظار بررسی", variant: "outline" },
  APPROVED: { label: "تأیید شده / در انتظار پرداخت", variant: "secondary" },
  PAID: { label: "پرداخت شده", variant: "default" },
  REJECTED: { label: "رد شده", variant: "destructive" },
  CANCELLED: { label: "لغو شده", variant: "outline" },
};

export const WITHDRAWAL_EVENT_LABELS = {
  CREATED: "ثبت درخواست",
  APPROVED: "تأیید توسط مدیر",
  REJECTED: "رد توسط مدیر",
  PAID: "ثبت پرداخت دستی (انتقال بانکی خارج از سایت)",
  CANCELLED: "لغو توسط متخصص",
} as const;
