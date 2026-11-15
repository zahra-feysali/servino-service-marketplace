import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { readStoredFile } from "@/lib/storage";
import { getAttachmentForUser } from "@/features/requests/queries";

/**
 * GET /api/attachments/:id — streams a private request attachment.
 * Allowed: the request's customer, an admin, or a provider matched to / offering on the request.
 * Unauthorized users get 404 (does not reveal existence).
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/attachments/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attachment = await getAttachmentForUser(user, id);
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readStoredFile(attachment.storageKey);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const inline = attachment.mimeType.startsWith("image/") || attachment.mimeType === "application/pdf";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
