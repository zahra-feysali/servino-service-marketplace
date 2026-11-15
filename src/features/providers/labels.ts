import type { ProviderVerificationStatus } from "@/generated/prisma/enums";

export const VERIFICATION_STATUS_META: Record<
  ProviderVerificationStatus,
  { label: string; description: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: {
    label: "در حال تکمیل پروفایل",
    description:
      "پروفایل حرفه‌ای شما هنوز برای بررسی ارسال نشده است. تا زمان تأیید توسط مدیر، درخواستی برای شما ارسال نمی‌شود.",
    variant: "outline",
  },
  PENDING: {
    label: "در انتظار تأیید",
    description: "پروفایل شما برای بررسی ارسال شده و پس از تأیید مدیر، می‌توانید درخواست‌ها را دریافت کنید.",
    variant: "secondary",
  },
  APPROVED: {
    label: "تأییدشده",
    description: "حساب حرفه‌ای شما تأیید شده است.",
    variant: "default",
  },
  REJECTED: {
    label: "ردشده",
    description: "پروفایل شما تأیید نشد. لطفاً اطلاعات را اصلاح و دوباره ارسال کنید.",
    variant: "destructive",
  },
};
