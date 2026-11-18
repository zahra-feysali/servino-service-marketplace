import { z } from "zod";
import { SLUG_REGEX } from "./markup";

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "نامک باید حداقل ۳ نویسه باشد.")
  .max(200)
  .regex(SLUG_REGEX, "نامک فقط شامل حروف کوچک انگلیسی، عدد و خط تیره است (مثال: home-cleaning-tips).");

const optional = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .transform((v) => (v === "" ? null : v));

export const blogPostSchema = z.object({
  title: z.string().trim().min(5, "عنوان باید حداقل ۵ نویسه باشد.").max(200, "عنوان بیش از حد طولانی است."),
  slug,
  excerpt: z.string().trim().min(20, "خلاصه باید حداقل ۲۰ نویسه باشد.").max(500, "خلاصه حداکثر ۵۰۰ نویسه است."),
  content: z.string().trim().min(50, "متن مقاله بیش از حد کوتاه است.").max(60_000, "متن مقاله بیش از حد طولانی است."),
  categoryId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || /^[0-9a-f-]{36}$/i.test(v), "دسته‌بندی نامعتبر است."),
  coverAlt: optional(200, "متن جایگزین تصویر حداکثر ۲۰۰ نویسه است."),
  seoTitle: optional(70, "عنوان سئو حداکثر ۷۰ نویسه است."),
  seoDescription: optional(160, "توضیح سئو حداکثر ۱۶۰ نویسه است."),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  removeCover: z.boolean(),
});
export type BlogPostInput = z.infer<typeof blogPostSchema>;

export const blogCategorySchema = z.object({
  name: z.string().trim().min(2, "نام دسته‌بندی را وارد کنید.").max(80),
  slug,
  description: optional(300, "توضیح حداکثر ۳۰۰ نویسه است."),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});
export type BlogCategoryInput = z.infer<typeof blogCategorySchema>;

export const BLOG_STATUS_META = {
  DRAFT: { label: "پیش‌نویس", variant: "outline" },
  PUBLISHED: { label: "منتشرشده", variant: "default" },
} as const;
