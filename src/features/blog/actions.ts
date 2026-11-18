"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { str } from "@/lib/form-data";
import { blogCategorySchema } from "./schemas";
import { deleteBlogCategory, deleteBlogPost, saveBlogCategory, setBlogPostStatus } from "./service";

/** Every action here requires ADMIN (re-checked from the database). */
async function admin<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    await requireRole("ADMIN");
    const r = await fn();
    revalidatePath("/blog", "layout");
    revalidatePath("/dashboard/admin/blog", "layout");
    return r;
  } catch (error) {
    return toActionError(error);
  }
}

export async function setBlogPostStatusAction(postId: string, status: "DRAFT" | "PUBLISHED") {
  return admin(async () => {
    if (!isUuid(postId) || (status !== "DRAFT" && status !== "PUBLISHED")) return fail("درخواست نامعتبر است.");
    await setBlogPostStatus(postId, status);
    return ok(undefined, status === "PUBLISHED" ? "مقاله منتشر شد." : "مقاله به پیش‌نویس برگشت.");
  });
}

export async function deleteBlogPostAction(postId: string): Promise<ActionResult<{ redirectTo: string }>> {
  return admin(async () => {
    if (!isUuid(postId)) return fail("درخواست نامعتبر است.");
    await deleteBlogPost(postId);
    return ok({ redirectTo: "/dashboard/admin/blog" }, "مقاله حذف شد.");
  });
}

export async function saveBlogCategoryAction(categoryId: string | null, formData: FormData) {
  return admin(async () => {
    if (categoryId !== null && !isUuid(categoryId)) return fail("درخواست نامعتبر است.");
    const parsed = blogCategorySchema.safeParse({
      name: str(formData, "name"),
      slug: str(formData, "slug"),
      description: str(formData, "description"),
      sortOrder: str(formData, "sortOrder") || "0",
    });
    if (!parsed.success) return fail("اطلاعات وارد شده معتبر نیست.", z.flattenError(parsed.error).fieldErrors);
    await saveBlogCategory(categoryId, parsed.data);
    return ok(undefined, categoryId ? "دسته‌بندی ویرایش شد." : "دسته‌بندی اضافه شد.");
  });
}

export async function deleteBlogCategoryAction(categoryId: string) {
  return admin(async () => {
    if (!isUuid(categoryId)) return fail("درخواست نامعتبر است.");
    await deleteBlogCategory(categoryId);
    return ok(undefined, "دسته‌بندی حذف شد؛ مقاله‌های آن بدون دسته‌بندی شدند.");
  });
}
