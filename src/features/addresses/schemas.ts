import { z } from "zod";

export const MAX_ADDRESSES = 20;

export const addressInputSchema = z.object({
  title: z.string().trim().min(2, "عنوان نشانی (مثلاً خانه) الزامی است.").max(60),
  cityId: z.uuid({ error: "شهر را انتخاب کنید." }),
  line: z.string().trim().min(10, "نشانی را کامل‌تر وارد کنید (حداقل ۱۰ کاراکتر).").max(300),
  postalCode: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || /^\d{10}$/.test(v), "کد پستی باید ۱۰ رقم باشد."),
  isDefault: z.boolean(),
});
export type AddressInput = z.input<typeof addressInputSchema>;
