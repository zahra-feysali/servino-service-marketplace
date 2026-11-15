import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { readStoredFile } from "@/lib/storage";

/**
 * GET /api/provider-files/document/:id — verification documents: owner provider or admin only.
 * GET /api/provider-files/portfolio/:id — portfolio images: public only for APPROVED providers
 * (plus the owner and admins).
 */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/provider-files/[kind]/[id]">) {
  const { kind, id } = await ctx.params;
  if (!isUuid(id) || (kind !== "document" && kind !== "portfolio")) return notFound();
  const user = await getCurrentUser();

  let key: string | null = null;
  let mime = "application/octet-stream";
  let name = "file";
  let isPublic = false;

  if (kind === "document") {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const doc = await prisma.providerDocument.findUnique({
      where: { id },
      select: { storageKey: true, mimeType: true, fileName: true, provider: { select: { userId: true } } },
    });
    if (!doc || (user.role !== "ADMIN" && doc.provider.userId !== user.id)) return notFound();
    key = doc.storageKey;
    mime = doc.mimeType;
    name = doc.fileName;
  } else {
    const item = await prisma.portfolioItem.findUnique({
      where: { id },
      select: { imageKey: true, title: true, provider: { select: { userId: true, verificationStatus: true } } },
    });
    if (!item?.imageKey) return notFound();
    isPublic = item.provider.verificationStatus === "APPROVED";
    const allowed = isPublic || user?.role === "ADMIN" || user?.id === item.provider.userId;
    if (!allowed) return notFound();
    key = item.imageKey;
    mime = key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
    name = item.title;
  }

  let bytes: Buffer;
  try {
    bytes = await readStoredFile(key);
  } catch {
    return notFound();
  }
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
