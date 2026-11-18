import { NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@/lib/db-locks";
import { fail } from "@/lib/errors";
import { handleBlogPostSave } from "@/features/blog/admin-handler";

/** POST /api/admin/blog/posts/:id — update a blog post (multipart, optional new cover). ADMIN only. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/blog/posts/[id]">) {
  const { id } = await ctx.params;
  if (!isUuid(id)) return NextResponse.json(fail("مقاله یافت نشد."), { status: 404 });
  return handleBlogPostSave(request, id);
}
