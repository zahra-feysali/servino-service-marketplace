import { z } from "zod";
import { toEnglishDigits } from "@/lib/utils";

/** Normalizes Iranian mobile numbers to the canonical `09xxxxxxxxx` form. */
export function normalizePhone(raw: string): string {
  let value = toEnglishDigits(raw).replace(/[\s\-()]/g, "");
  if (value.startsWith("+98")) value = `0${value.slice(3)}`;
  else if (value.startsWith("0098")) value = `0${value.slice(4)}`;
  else if (value.startsWith("98") && value.length === 12) value = `0${value.slice(2)}`;
  else if (value.startsWith("9") && value.length === 10) value = `0${value}`;
  return value;
}

export const PHONE_REGEX = /^09\d{9}$/;

export const phoneSchema = z
  .string({ error: "شماره موبایل الزامی است." })
  .trim()
  .min(1, "شماره موبایل الزامی است.")
  .transform(normalizePhone)
  .refine((v) => PHONE_REGEX.test(v), "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷).");

export const passwordSchema = z
  .string({ error: "رمز عبور الزامی است." })
  .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.")
  .max(72, "رمز عبور حداکثر می‌تواند ۷۲ کاراکتر باشد.")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(toEnglishDigits(v)), "رمز عبور باید شامل حرف و عدد باشد.");

const optionalEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(191)
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || z.email().safeParse(v).success, "ایمیل معتبر نیست.");

export const fullNameSchema = z
  .string({ error: "نام و نام خانوادگی الزامی است." })
  .trim()
  .min(3, "نام و نام خانوادگی باید حداقل ۳ کاراکتر باشد.")
  .max(120, "نام و نام خانوادگی طولانی است.");

/** Login accepts a mobile number or an email address as identifier. */
export const loginSchema = z.object({
  identifier: z
    .string({ error: "شماره موبایل یا ایمیل الزامی است." })
    .trim()
    .min(1, "شماره موبایل یا ایمیل الزامی است.")
    .max(191),
  password: z.string({ error: "رمز عبور الزامی است." }).min(1, "رمز عبور الزامی است.").max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Public self-registration is only possible for CUSTOMER and PROVIDER — never ADMIN. */
export const registerRoleSchema = z.enum(["CUSTOMER", "PROVIDER"]);
export type RegisterRole = z.infer<typeof registerRoleSchema>;

export const registerSchema = z
  .object({
    role: registerRoleSchema,
    fullName: fullNameSchema,
    phone: phoneSchema,
    email: optionalEmailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    displayName: z.string().trim().max(120).optional(),
    acceptTerms: z.literal(true, { error: "پذیرش قوانین و مقررات الزامی است." }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "تکرار رمز عبور با رمز عبور یکسان نیست.",
  });
export type RegisterInput = z.input<typeof registerSchema>;
export type RegisterData = z.output<typeof registerSchema>;

export const updateProfileSchema = z.object({
  fullName: fullNameSchema,
  email: optionalEmailSchema,
});
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "رمز عبور فعلی الزامی است."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "تکرار رمز عبور با رمز عبور جدید یکسان نیست.",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "رمز عبور جدید باید با رمز فعلی متفاوت باشد.",
  });
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

/** Decides whether an identifier is an email or a phone number. */
export function parseIdentifier(identifier: string): { kind: "email"; value: string } | { kind: "phone"; value: string } | null {
  const trimmed = identifier.trim();
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    return z.email().safeParse(email).success ? { kind: "email", value: email } : null;
  }
  const phone = normalizePhone(trimmed);
  return PHONE_REGEX.test(phone) ? { kind: "phone", value: phone } : null;
}
