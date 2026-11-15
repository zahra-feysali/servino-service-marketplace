import { z } from "zod";

/** Provider professional profile & verification rules (pure). */

export type VerificationStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";

export type ProfileCompleteness = {
  displayName: string;
  bio: string | null;
  servicesCount: number;
  areasCount: number;
  documentsCount: number;
};

export const CHECKLIST_LABELS = {
  bio: "معرفی و توضیحات حرفه‌ای (حداقل ۳۰ کاراکتر)",
  services: "انتخاب حداقل یک خدمت",
  areas: "انتخاب حداقل یک منطقه خدمت‌رسانی",
  documents: "بارگذاری حداقل یک مدرک احراز هویت یا گواهی",
} as const;

export function verificationChecklist(p: ProfileCompleteness) {
  return [
    { key: "bio" as const, done: (p.bio?.trim().length ?? 0) >= 30 },
    { key: "services" as const, done: p.servicesCount > 0 },
    { key: "areas" as const, done: p.areasCount > 0 },
    { key: "documents" as const, done: p.documentsCount > 0 },
  ];
}

/** Providers can submit (or resubmit) only from DRAFT/REJECTED with a complete profile. */
export function canSubmitForVerification(status: VerificationStatus, p: ProfileCompleteness): "INVALID_STATE" | "INCOMPLETE" | null {
  if (status !== "DRAFT" && status !== "REJECTED") return "INVALID_STATE";
  if (!verificationChecklist(p).every((i) => i.done)) return "INCOMPLETE";
  return null;
}

/** Admin review decisions are only possible on PENDING profiles; rejection needs a reason. */
export function canReview(status: VerificationStatus, decision: "APPROVE" | "REJECT", reason?: string | null): "NOT_PENDING" | "REASON_REQUIRED" | null {
  if (status !== "PENDING") return "NOT_PENDING";
  if (decision === "REJECT" && !reason?.trim()) return "REASON_REQUIRED";
  return null;
}

export const profileInputSchema = z.object({
  displayName: z.string().trim().min(3, "نام نمایشی حداقل ۳ کاراکتر است.").max(120),
  bio: z.string().trim().max(3000, "حداکثر ۳۰۰۰ کاراکتر").optional().transform((v) => v || null),
  yearsOfExperience: z.preprocess((v) => (v === "" || v === undefined ? 0 : Number(v)), z.number().int().min(0, "نامعتبر").max(70, "نامعتبر")),
});

export const skillInputSchema = z.object({
  name: z.string().trim().min(2, "نام مهارت حداقل ۲ کاراکتر است.").max(80),
});

export const portfolioInputSchema = z.object({
  title: z.string().trim().min(3, "عنوان نمونه‌کار حداقل ۳ کاراکتر است.").max(150),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
});

export const documentInputSchema = z.object({
  type: z.enum(["NATIONAL_ID", "CERTIFICATE", "LICENSE", "OTHER"]),
  title: z.string().trim().min(3, "عنوان مدرک حداقل ۳ کاراکتر است.").max(150),
});

export const DOCUMENT_TYPE_LABELS = {
  NATIONAL_ID: "کارت ملی / مدرک هویتی",
  CERTIFICATE: "گواهی / مدرک فنی",
  LICENSE: "پروانه کسب / مجوز",
  OTHER: "سایر",
} as const;

export const DOCUMENT_STATUS_META = {
  PENDING: { label: "در انتظار بررسی", variant: "outline" },
  APPROVED: { label: "تأییدشده", variant: "default" },
  REJECTED: { label: "ردشده", variant: "destructive" },
} as const;

export const MAX_SKILLS = 30;
export const MAX_PORTFOLIO_ITEMS = 30;
export const MAX_DOCUMENTS = 10;
export const MAX_SERVICE_AREAS = 50;
export const MAX_PROVIDER_SERVICES = 30;
