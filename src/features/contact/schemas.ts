import { z } from "zod";
import { PHONE_REGEX } from "@/features/auth/schemas";
import { toEnglishDigits } from "@/lib/utils";

/** Public contact form (shared by the server action and tests). Phone or email is required. */
export const contactSchema = z
  .object({
    name: z.string().trim().min(2, "نام را وارد کنید.").max(120, "نام بیش از حد طولانی است."),
    phone: z
      .string()
      .trim()
      .transform((v) => toEnglishDigits(v))
      .refine((v) => v === "" || PHONE_REGEX.test(v), "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷).")
      .transform((v) => (v === "" ? null : v)),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .refine((v) => v === "" || z.email().safeParse(v).success, "ایمیل معتبر نیست.")
      .transform((v) => (v === "" ? null : v)),
    subject: z.string().trim().min(3, "موضوع را وارد کنید.").max(150, "موضوع بیش از حد طولانی است."),
    message: z.string().trim().min(10, "متن پیام باید حداقل ۱۰ نویسه باشد.").max(3000, "حداکثر ۳۰۰۰ نویسه مجاز است."),
  })
  .refine((v) => v.phone || v.email, { message: "شماره موبایل یا ایمیل را برای پاسخ‌گویی وارد کنید.", path: ["phone"] });

export type ContactInput = z.infer<typeof contactSchema>;

export const CONTACT_STATUS_META = {
  NEW: { label: "جدید", variant: "default" },
  READ: { label: "خوانده‌شده", variant: "secondary" },
  ARCHIVED: { label: "بایگانی", variant: "outline" },
} as const;
