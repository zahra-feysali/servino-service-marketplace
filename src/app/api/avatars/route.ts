import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/authz";
import { bodySizeError, isSameOriginRequest } from "@/lib/request-guards";
import { AppError, fail, ok, toActionError } from "@/lib/errors";
import { file } from "@/lib/form-data";
import { setAvatar } from "@/features/avatars/service";
import { AVATAR_MAX_BYTES } from "@/features/avatars/rules";

/** POST /api/avatars — the signed-in user uploads (or replaces) their own profile picture. */
export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json(fail("درخواست نامعتبر است."), { status: 403 });
    const user = await requireUser();
    const sizeError = bodySizeError(request, AVATAR_MAX_BYTES + 64 * 1024);
    if (sizeError) {
      return NextResponse.json(fail(sizeError === "TOO_LARGE" ? "حجم تصویر بیش از ۲ مگابایت است." : "درخواست نامعتبر است."), {
        status: sizeError === "TOO_LARGE" ? 413 : 411,
      });
    }
    const form = await request.formData();
    const f = file(form, "avatar");
    if (!f) return NextResponse.json(fail("تصویری انتخاب نشده است.", { avatar: ["تصویری انتخاب نشده است."] }), { status: 400 });
    await setAvatar(user.id, f);
    return NextResponse.json(ok(undefined, "تصویر پروفایل به‌روزرسانی شد."));
  } catch (error) {
    const status = error instanceof AppError ? (error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 400) : 500;
    return NextResponse.json(toActionError(error), { status });
  }
}
