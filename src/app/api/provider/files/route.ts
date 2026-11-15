import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { AppError, fail, ok, toActionError } from "@/lib/errors";
import { file, str } from "@/lib/form-data";
import { addPortfolioItem, addProviderDocument } from "@/features/providers/profile-service";
import { documentInputSchema, portfolioInputSchema } from "@/features/providers/verification";

/**
 * POST /api/provider/files — provider uploads a verification document or a portfolio item (multipart).
 * Route Handler (not a Server Action) because files may exceed the 1 MB Server Action body limit.
 */
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) return NextResponse.json(fail("درخواست نامعتبر است."), { status: 403 });
    const user = await requireRole("PROVIDER");
    if (Number(request.headers.get("content-length") ?? "0") > 6 * 1024 * 1024) {
      return NextResponse.json(fail("حجم فایل بیش از حد مجاز است."), { status: 413 });
    }
    const form = await request.formData();
    const kind = str(form, "kind");

    if (kind === "document") {
      const parsed = documentInputSchema.safeParse({ type: str(form, "type"), title: str(form, "title") });
      if (!parsed.success) return NextResponse.json(fail("اطلاعات مدرک معتبر نیست.", z.flattenError(parsed.error).fieldErrors), { status: 400 });
      const f = file(form, "file");
      if (!f) return NextResponse.json(fail("فایل مدرک را انتخاب کنید.", { file: ["فایل مدرک را انتخاب کنید."] }), { status: 400 });
      await addProviderDocument(user.id, parsed.data, f);
      return NextResponse.json(ok(undefined, "مدرک بارگذاری شد و در انتظار بررسی است."));
    }

    if (kind === "portfolio") {
      const parsed = portfolioInputSchema.safeParse({ title: str(form, "title"), description: str(form, "description") });
      if (!parsed.success) return NextResponse.json(fail("اطلاعات نمونه‌کار معتبر نیست.", z.flattenError(parsed.error).fieldErrors), { status: 400 });
      await addPortfolioItem(user.id, parsed.data, file(form, "image"));
      return NextResponse.json(ok(undefined, "نمونه‌کار اضافه شد."));
    }

    throw new AppError("نوع بارگذاری نامعتبر است.", "VALIDATION");
  } catch (error) {
    const status = error instanceof AppError ? (error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 400) : 500;
    return NextResponse.json(toActionError(error), { status });
  }
}
