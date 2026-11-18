import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { readStoredFile } from "@/lib/storage";
import { getBlogCover } from "@/features/blog/queries";

/** GET /api/blog-covers/:postId — uploaded cover image (public once published; drafts for admins only). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/blog-covers/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const post = await getBlogCover(id);
  if (!post?.coverImageKey) return notFound();
  const isPublic = post.status === "PUBLISHED" && !!post.publishedAt && post.publishedAt <= new Date();
  if (!isPublic) {
    const user = await getCurrentUser();
    if (user?.role !== "ADMIN") return notFound();
  }
  let bytes: Buffer;
  try {
    bytes = await readStoredFile(post.coverImageKey);
  } catch {
    return notFound();
  }
  const key = post.coverImageKey;
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg",
      "Content-Length": String(bytes.byteLength),
      // Versioned URL (?v=updatedAt) → a long cache is safe for published covers.
      "Cache-Control": isPublic ? "public, max-age=86400" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
    },
  });
}

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
