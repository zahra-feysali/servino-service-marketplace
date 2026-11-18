import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { bodySizeError, isSameOriginRequest } from "@/lib/request-guards";
import { AppError, fail, ok, toActionError } from "@/lib/errors";
import { readMessages, sendMessage } from "@/features/chat/service";
import { CHAT_FILE_MAX_BYTES, MAX_CHAT_FILES, messageBodySchema } from "@/features/chat/rules";

function statusFor(error: unknown) {
  if (!(error instanceof AppError)) return 500;
  if (error.code === "UNAUTHENTICATED") return 401;
  if (error.code === "FORBIDDEN") return 403;
  if (error.code === "NOT_FOUND") return 404;
  return 400;
}

function parseDate(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** GET — messages for a participant (`?after=ISO` for polling, `?before=ISO` for older pages). Marks incoming as read. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/conversations/[id]/messages">) {
  try {
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json(fail("گفتگو یافت نشد."), { status: 404 });
    const user = await requireUser();
    const sp = request.nextUrl.searchParams;
    const data = await readMessages(user, id, { after: parseDate(sp.get("after")), before: parseDate(sp.get("before")) });
    return NextResponse.json(ok(data), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json(toActionError(error), { status: statusFor(error) });
  }
}

/** POST — send a message (multipart: `body` text and up to 5 `files`). */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/conversations/[id]/messages">) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json(fail("درخواست نامعتبر است."), { status: 403 });
    const { id } = await ctx.params;
    if (!isUuid(id)) return NextResponse.json(fail("گفتگو یافت نشد."), { status: 404 });
    const user = await requireUser();
    const sizeError = bodySizeError(request, MAX_CHAT_FILES * CHAT_FILE_MAX_BYTES + 256 * 1024);
    if (sizeError) {
      return NextResponse.json(fail(sizeError === "TOO_LARGE" ? "حجم فایل‌ها بیش از حد مجاز است." : "درخواست نامعتبر است."), {
        status: sizeError === "TOO_LARGE" ? 413 : 411,
      });
    }
    const form = await request.formData();
    const rawBody = form.get("body");
    const parsed = messageBodySchema.safeParse(typeof rawBody === "string" ? rawBody : "");
    if (!parsed.success) return NextResponse.json(fail(parsed.error.issues[0]?.message ?? "پیام نامعتبر است."), { status: 400 });
    const files = form.getAll("files").filter((v): v is File => v instanceof File && v.size > 0);
    const message = await sendMessage(user, id, parsed.data, files);
    return NextResponse.json(ok(message), { status: 201 });
  } catch (error) {
    return NextResponse.json(toActionError(error), { status: statusFor(error) });
  }
}
