import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError, isUniqueConstraintError } from "@/lib/errors";
import { deleteStoredFiles, saveFile } from "@/lib/storage";
import { IMAGE_MIME_TYPES, readValidatedFile } from "@/lib/uploads";
import { readingMinutes } from "./markup";
import type { BlogCategoryInput, BlogPostInput } from "./schemas";

const SLUG_TAKEN = new AppError("این نامک قبلاً استفاده شده است.", "VALIDATION", { slug: ["این نامک قبلاً استفاده شده است."] });
export const BLOG_COVER_MAX_BYTES = 5 * 1024 * 1024;

async function assertCategory(categoryId: string | null) {
  if (!categoryId) return;
  const exists = await prisma.blogCategory.count({ where: { id: categoryId } });
  if (!exists) throw new AppError("دسته‌بندی یافت نشد.", "VALIDATION", { categoryId: ["دسته‌بندی یافت نشد."] });
}

/**
 * Creates or updates a post. `publishedAt` is set the first time a post is published and kept
 * afterwards (unpublishing → draft keeps the original date for a later re-publish).
 * A new cover replaces the old one; old files are removed only after the DB write succeeds.
 */
export async function saveBlogPost(authorId: string, postId: string | null, input: BlogPostInput, cover: File | null) {
  await assertCategory(input.categoryId);
  const existing = postId
    ? await prisma.blogPost.findUnique({ where: { id: postId }, select: { id: true, coverImageKey: true, publishedAt: true } })
    : null;
  if (postId && !existing) throw new NotFoundError("مقاله یافت نشد.");

  let newKey: string | null = null;
  if (cover) {
    const f = await readValidatedFile(cover, IMAGE_MIME_TYPES, BLOG_COVER_MAX_BYTES);
    newKey = await saveFile(f.bytes, f.mime);
  }
  const { removeCover, ...fields } = input;
  const data = {
    ...fields,
    readingMinutes: readingMinutes(input.content),
    publishedAt: input.status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null),
    ...(newKey ? { coverImageKey: newKey, coverImagePath: null } : removeCover ? { coverImageKey: null, coverImagePath: null } : {}),
  };

  try {
    const post = existing
      ? await prisma.blogPost.update({ where: { id: existing.id }, data, select: { id: true, slug: true } })
      : await prisma.blogPost.create({ data: { ...data, authorId }, select: { id: true, slug: true } });
    if (existing?.coverImageKey && (newKey || removeCover)) await deleteStoredFiles([existing.coverImageKey]);
    return post;
  } catch (e) {
    if (newKey) await deleteStoredFiles([newKey]);
    if (isUniqueConstraintError(e)) throw SLUG_TAKEN;
    throw e;
  }
}

export async function setBlogPostStatus(postId: string, status: "DRAFT" | "PUBLISHED") {
  const post = await prisma.blogPost.findUnique({ where: { id: postId }, select: { publishedAt: true } });
  if (!post) throw new NotFoundError("مقاله یافت نشد.");
  await prisma.blogPost.update({
    where: { id: postId },
    data: { status, ...(status === "PUBLISHED" && !post.publishedAt ? { publishedAt: new Date() } : {}) },
  });
}

export async function deleteBlogPost(postId: string) {
  const post = await prisma.blogPost.findUnique({ where: { id: postId }, select: { coverImageKey: true } });
  if (!post) throw new NotFoundError("مقاله یافت نشد.");
  await prisma.blogPost.delete({ where: { id: postId } });
  if (post.coverImageKey) await deleteStoredFiles([post.coverImageKey]);
}

export async function saveBlogCategory(categoryId: string | null, input: BlogCategoryInput) {
  try {
    if (categoryId) {
      const r = await prisma.blogCategory.updateMany({ where: { id: categoryId }, data: input });
      if (r.count === 0) throw new NotFoundError("دسته‌بندی یافت نشد.");
      return;
    }
    await prisma.blogCategory.create({ data: input });
  } catch (e) {
    if (isUniqueConstraintError(e)) throw SLUG_TAKEN;
    throw e;
  }
}

/** Deleting a category keeps its posts (they become uncategorised). */
export async function deleteBlogCategory(categoryId: string) {
  const r = await prisma.blogCategory.deleteMany({ where: { id: categoryId } });
  if (r.count === 0) throw new NotFoundError("دسته‌بندی یافت نشد.");
}
