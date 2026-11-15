import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/authz";
import { AppError, toActionError } from "@/lib/errors";
import { FILE_FIELD_PREFIX, GENERAL_ATTACHMENTS_FIELD } from "@/features/requests/schemas";
import { submitServiceRequest, type UploadedFile } from "@/features/requests/service";

/** Upper bound for the whole multipart body (dynamic fields + general attachments). */
const MAX_BODY_BYTES = 30 * 1024 * 1024;

/**
 * POST /api/requests — customer submits a service request (multipart/form-data).
 * A Route Handler is used instead of a Server Action because requests can carry files
 * (Server Actions are limited to 1 MB unless an experimental option is enabled).
 *
 * Fields: `data` (JSON: { base, answers }), `file:<fieldName>` (dynamic FILE fields),
 * `__attachments` (general attachments).
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF defence-in-depth: only same-origin browser requests (session cookie is SameSite=Lax).
    const origin = request.headers.get("origin");
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ ok: false, error: "درخواست نامعتبر است." }, { status: 403 });
    }

    const user = await requireRole("CUSTOMER");

    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "حجم کل فایل‌ها بیش از حد مجاز است." }, { status: 413 });
    }
    if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
      return NextResponse.json({ ok: false, error: "قالب درخواست نامعتبر است." }, { status: 415 });
    }

    const form = await request.formData();
    const raw = form.get("data");
    if (typeof raw !== "string") throw new AppError("اطلاعات درخواست ارسال نشده است.", "VALIDATION");
    let payload: { base?: unknown; answers?: unknown };
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new AppError("اطلاعات درخواست نامعتبر است.", "VALIDATION");
    }

    const uploads: UploadedFile[] = [];
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") continue;
      if (key === GENERAL_ATTACHMENTS_FIELD) uploads.push({ fieldName: null, file: value });
      else if (key.startsWith(FILE_FIELD_PREFIX)) uploads.push({ fieldName: key.slice(FILE_FIELD_PREFIX.length), file: value });
      else throw new AppError("فایل ناشناخته ارسال شده است.", "INVALID_FILE");
    }

    const result = await submitServiceRequest(user.id, { base: payload.base, answers: payload.answers }, uploads);
    return NextResponse.json({ ok: true, data: result, message: "درخواست شما ثبت شد." }, { status: 201 });
  } catch (error) {
    const result = toActionError(error);
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
    return NextResponse.json(result, { status });
  }
}
