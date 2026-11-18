import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";
import { getAvatarForViewer } from "@/features/avatars/service";

/** GET /api/avatars/:userId — profile picture, subject to `canViewAvatar` (404 when hidden or missing). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/avatars/[userId]">) {
  const { userId } = await ctx.params;
  if (!isUuid(userId)) return notFound();
  const viewer = await getCurrentUser();
  let avatar: Awaited<ReturnType<typeof getAvatarForViewer>>;
  try {
    avatar = await getAvatarForViewer(viewer ? { id: viewer.id, role: viewer.role } : null, userId);
  } catch {
    return notFound();
  }
  if (!avatar) return notFound();
  return new NextResponse(new Uint8Array(avatar.bytes), {
    headers: {
      "Content-Type": avatar.mime,
      "Content-Length": String(avatar.bytes.byteLength),
      // URLs are versioned (?v=…), so a private cache may keep the image; never shared caches.
      "Cache-Control": avatar.isPublic ? "private, max-age=86400" : "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
    },
  });
}

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
