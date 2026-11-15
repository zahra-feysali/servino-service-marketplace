import { z } from "zod";
import { isIsoDate } from "@/features/forms/definitions";

/** Fixed (non-dynamic) part of a service request. Dynamic answers are validated by buildAnswersSchema. */
export const requestBaseSchema = z.object({
  serviceId: z.uuid({ error: "خدمت معتبر نیست." }),
  cityId: z.uuid({ error: "شهر را انتخاب کنید." }),
  addressText: z.string().trim().min(10, "نشانی را کامل‌تر وارد کنید (حداقل ۱۰ کاراکتر).").max(300),
  description: z
    .string()
    .trim()
    .max(3000, "توضیحات حداکثر ۳۰۰۰ کاراکتر است.")
    .optional()
    .transform((v) => (v ? v : undefined)),
  preferredDate: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || isIsoDate(v), "تاریخ معتبر نیست."),
});
export type RequestBaseInput = z.input<typeof requestBaseSchema>;

export const cancelRequestSchema = z.object({
  reason: z.string().trim().min(3, "دلیل لغو را بنویسید.").max(500),
});

/** Field names used in the multipart payload. */
export const GENERAL_ATTACHMENTS_FIELD = "__attachments";
export const FILE_FIELD_PREFIX = "file:";
