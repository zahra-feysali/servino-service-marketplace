import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DB_AVAILABLE } from "./db";

/** Blog CRUD / publishing and contact messages against PostgreSQL. */
describe.skipIf(!DB_AVAILABLE)("blog and contact (PostgreSQL)", async () => {
  const { prisma } = await import("@/lib/prisma");
  const blog = await import("@/features/blog/service");
  const q = await import("@/features/blog/queries");
  const contact = await import("@/features/contact/service");
  const { readStoredFile } = await import("@/lib/storage");

  const tag = randomUUID().slice(0, 8);
  let adminId = "";
  let categoryId = "";
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 4, 4]);
  const contactIds: string[] = [];

  const input = (over: Partial<Parameters<typeof blog.saveBlogPost>[2]> = {}) => ({
    title: `مقاله آزمایشی ${tag}`,
    slug: `test-post-${tag}`,
    excerpt: "این خلاصه‌ای آزمایشی برای سنجش انتشار مقاله است.",
    content: "## تیتر\n" + "متن آزمایشی ".repeat(40),
    categoryId: null as string | null,
    coverAlt: null,
    seoTitle: null,
    seoDescription: null,
    status: "DRAFT" as "DRAFT" | "PUBLISHED",
    removeCover: false,
    ...over,
  });

  beforeAll(async () => {
    const admin = await prisma.user.create({ data: { fullName: "مدیر بلاگ", phone: `0931${String(Date.now()).slice(-7)}`, passwordHash: "x", role: "ADMIN" } });
    adminId = admin.id;
    await blog.saveBlogCategory(null, { name: `دسته ${tag}`, slug: `cat-${tag}`, description: null, sortOrder: 0 });
    categoryId = (await prisma.blogCategory.findUniqueOrThrow({ where: { slug: `cat-${tag}` } })).id;
  });

  afterAll(async () => {
    const posts = await prisma.blogPost.findMany({ where: { authorId: adminId }, select: { id: true } });
    for (const p of posts) await blog.deleteBlogPost(p.id).catch(() => undefined);
    await prisma.blogCategory.deleteMany({ where: { slug: `cat-${tag}` } });
    await prisma.contactMessage.deleteMany({ where: { id: { in: contactIds } } });
    await prisma.user.delete({ where: { id: adminId } });
    await prisma.$disconnect();
  });

  it("keeps drafts private and publishes with a stable publish date", async () => {
    const post = await blog.saveBlogPost(adminId, null, input({ categoryId }), null);
    expect(await q.getPublishedPost(post.slug)).toBeNull();

    await blog.setBlogPostStatus(post.id, "PUBLISHED");
    const published = await q.getPublishedPost(post.slug);
    expect(published?.title).toContain(tag);
    expect(published?.readingMinutes).toBeGreaterThanOrEqual(1);
    const firstDate = published!.publishedAt!;

    await blog.setBlogPostStatus(post.id, "DRAFT");
    expect(await q.getPublishedPost(post.slug)).toBeNull();
    await blog.setBlogPostStatus(post.id, "PUBLISHED");
    expect((await q.getPublishedPost(post.slug))!.publishedAt!.getTime()).toBe(firstDate.getTime());

    const list = await q.listPublishedPosts({ categorySlug: `cat-${tag}` }, 1);
    expect(list.items.map((p) => p.id)).toEqual([post.id]);
  });

  it("rejects duplicate slugs", async () => {
    await expect(blog.saveBlogPost(adminId, null, input(), null)).rejects.toThrow("نامک");
  });

  it("uploads, replaces and removes the cover image", async () => {
    const post = await prisma.blogPost.findUniqueOrThrow({ where: { slug: `test-post-${tag}` } });
    await blog.saveBlogPost(adminId, post.id, input({ status: "PUBLISHED" }), new File([PNG], "c.png", { type: "image/png" }));
    const withCover = await prisma.blogPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(withCover.coverImageKey).toMatch(/\.png$/);
    expect(Buffer.from(await readStoredFile(withCover.coverImageKey!)).equals(Buffer.from(PNG))).toBe(true);

    const fake = new File([new TextEncoder().encode("nope")], "x.png", { type: "image/png" });
    await expect(blog.saveBlogPost(adminId, post.id, input({ status: "PUBLISHED" }), fake)).rejects.toThrow("مجاز نیست");

    await blog.saveBlogPost(adminId, post.id, input({ status: "PUBLISHED", removeCover: true }), null);
    const noCover = await prisma.blogPost.findUniqueOrThrow({ where: { id: post.id } });
    expect(noCover.coverImageKey).toBeNull();
    await expect(readStoredFile(withCover.coverImageKey!)).rejects.toThrow(); // old file deleted
  });

  it("keeps posts when their category is deleted, then deletes posts", async () => {
    await blog.deleteBlogCategory(categoryId);
    const post = await prisma.blogPost.findUniqueOrThrow({ where: { slug: `test-post-${tag}` } });
    expect(post.categoryId).toBeNull();
    await blog.deleteBlogPost(post.id);
    expect(await prisma.blogPost.count({ where: { id: post.id } })).toBe(0);
  });

  it("stores contact messages and lets the admin change their status", async () => {
    const m = await contact.createContactMessage(
      { name: "بازدیدکننده", phone: "09121234567", email: null, subject: `موضوع ${tag}`, message: "پیام آزمایشی برای صندوق مدیریت." },
      null,
    );
    contactIds.push(m.id);
    const list = await contact.adminListContactMessages("NEW", 1);
    expect(list.items.some((i) => i.id === m.id)).toBe(true);
    await contact.setContactMessageStatus(m.id, "READ");
    const row = await prisma.contactMessage.findUniqueOrThrow({ where: { id: m.id } });
    expect(row.status).toBe("READ");
    expect(row.readAt).not.toBeNull();
    await contact.setContactMessageStatus(m.id, "ARCHIVED");
    expect((await contact.adminListContactMessages(undefined, 1)).items.some((i) => i.id === m.id)).toBe(false);
    await expect(contact.setContactMessageStatus(randomUUID(), "READ")).rejects.toThrow();
  });
});
