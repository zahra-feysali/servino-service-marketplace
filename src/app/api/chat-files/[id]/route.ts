import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { readStoredFile } from "@/lib/storage";
import { getChatAttachment } from "@/features/chat/service";

/** GET /api/chat-files/:id — chat attachment, only for the two participants of the conversation. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/chat-files/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const file = await getChatAttachment(user, id);
  if (!file) return notFound();
  let bytes: Buffer;
  try {
    bytes = await readStoredFile(file.storageKey);
  } catch {
    return notFound();
  }
  const download = request.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
