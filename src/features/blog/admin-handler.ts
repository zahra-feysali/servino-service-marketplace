import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { bodySizeError, isSameOriginRequest } from "@/lib/request-guards";
import { AppError, fail, ok, toActionError } from "@/lib/errors";
import { bool, file, str } from "@/lib/form-data";
import { blogPostSchema } from "./schemas";
import { BLOG_COVER_MAX_BYTES, saveBlogPost } from "./service";

/** Shared multipart handler for creating (postId = null) and updating blog posts. ADMIN only. */
export async function handleBlogPostSave(request: NextRequest, postId: string | null) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json(fail("درخواست نامعتبر است."), { status: 403 });
    const admin = await requireRole("ADMIN");
    const sizeError = bodySizeError(request, BLOG_COVER_MAX_BYTES + 512 * 1024);
    if (sizeError) {
      return NextResponse.json(fail(sizeError === "TOO_LARGE" ? "حجم تصویر بیش از حد مجاز است." : "درخواست نامعتبر است."), {
        status: sizeError === "TOO_LARGE" ? 413 : 411,
      });
    }
    const form = await request.formData();
    const parsed = blogPostSchema.safeParse({
      title: str(form, "title"),
      slug: str(form, "slug"),
      excerpt: str(form, "excerpt"),
      content: str(form, "content"),
      categoryId: str(form, "categoryId"),
      coverAlt: str(form, "coverAlt"),
      seoTitle: str(form, "seoTitle"),
      seoDescription: str(form, "seoDescription"),
      status: str(form, "status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
      removeCover: bool(form, "removeCover"),
    });
    if (!parsed.success) {
      return NextResponse.json(fail("لطفاً خطاهای فرم را برطرف کنید.", z.flattenError(parsed.error).fieldErrors), { status: 400 });
    }
    const post = await saveBlogPost(admin.id, postId, parsed.data, file(form, "cover"));
    return NextResponse.json(
      ok({ redirectTo: `/dashboard/admin/blog/${post.id}` }, parsed.data.status === "PUBLISHED" ? "مقاله ذخیره و منتشر شد." : "پیش‌نویس ذخیره شد."),
    );
  } catch (error) {
    const status =
      error instanceof AppError
        ? error.code === "UNAUTHENTICATED"
          ? 401
          : error.code === "FORBIDDEN"
            ? 403
            : error.code === "NOT_FOUND"
              ? 404
              : 400
        : 500;
    return NextResponse.json(toActionError(error), { status });
  }
}
