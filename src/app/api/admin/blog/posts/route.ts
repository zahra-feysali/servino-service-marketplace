import type { NextRequest } from "next/server";
import { handleBlogPostSave } from "@/features/blog/admin-handler";

/** POST /api/admin/blog/posts — create a blog post (multipart, optional cover). ADMIN only. */
export async function POST(request: NextRequest) {
  return handleBlogPostSave(request, null);
}
