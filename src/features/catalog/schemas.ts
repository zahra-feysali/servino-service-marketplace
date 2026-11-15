import { z } from "zod";
import { SERVICE_ICON_NAMES } from "./icons";

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "نامک حداقل ۲ کاراکتر است.")
  .max(100)
  .regex(SLUG_REGEX, "نامک فقط شامل حروف کوچک انگلیسی، عدد و خط تیره باشد (مثال: home-cleaning).");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

const iconSchema = z
  .union([z.enum(SERVICE_ICON_NAMES), z.literal("")])
  .optional()
  .transform((v) => (v ? v : undefined));

const sortOrderSchema = z.preprocess(
  (v) => (v === "" || v === undefined ? 0 : typeof v === "string" ? Number(v) : v),
  z.number().int().min(0).max(10_000),
);

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "نام دسته‌بندی الزامی است.").max(100),
  slug: slugSchema,
  description: optionalText(1000),
  icon: iconSchema,
  parentId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : null)),
  isActive: z.boolean(),
  sortOrder: sortOrderSchema,
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

export const serviceInputSchema = z.object({
  categoryId: z.uuid({ error: "دسته‌بندی را انتخاب کنید." }),
  name: z.string().trim().min(2, "نام خدمت الزامی است.").max(120),
  slug: slugSchema,
  shortDescription: optionalText(300),
  description: optionalText(5000),
  icon: iconSchema,
  isActive: z.boolean(),
  sortOrder: sortOrderSchema,
});
export type ServiceInput = z.input<typeof serviceInputSchema>;
