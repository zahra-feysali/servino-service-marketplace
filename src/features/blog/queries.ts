import { prisma } from "@/lib/prisma";
import { pageArgs, toPaginated } from "@/lib/pagination";

/** A post is public when PUBLISHED and its publish date has passed. */
const publicWhere = () => ({ status: "PUBLISHED" as const, publishedAt: { lte: new Date() } });

const cardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImageKey: true,
  coverImagePath: true,
  coverAlt: true,
  publishedAt: true,
  readingMinutes: true,
  updatedAt: true,
  category: { select: { name: true, slug: true } },
} as const;

export type BlogCard = Awaited<ReturnType<typeof listLatestPosts>>[number];

/** Cover URL: bundled static image, the private-storage route for uploads, or null. */
export function coverSrc(p: { id: string; coverImageKey: string | null; coverImagePath: string | null; updatedAt: Date }) {
  if (p.coverImageKey) return `/api/blog-covers/${p.id}?v=${p.updatedAt.getTime()}`;
  return p.coverImagePath;
}

export async function listPublishedPosts(filter: { categorySlug?: string }, page: number) {
  const where = { ...publicWhere(), ...(filter.categorySlug ? { category: { slug: filter.categorySlug } } : {}) };
  const [items, total] = await Promise.all([
    prisma.blogPost.findMany({ where, orderBy: { publishedAt: "desc" }, ...pageArgs(page, 9), select: cardSelect }),
    prisma.blogPost.count({ where }),
  ]);
  return toPaginated(items, total, page, 9);
}

export async function listLatestPosts(take = 3) {
  return prisma.blogPost.findMany({ where: publicWhere(), orderBy: { publishedAt: "desc" }, take, select: cardSelect });
}

export async function listBlogCategories() {
  const cats = await prisma.blogCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, description: true, sortOrder: true, _count: { select: { posts: { where: publicWhere() } } } },
  });
  return cats.map(({ _count, ...c }) => ({ ...c, postCount: _count.posts }));
}

export async function getPublishedPost(slug: string) {
  return prisma.blogPost.findFirst({
    where: { slug, ...publicWhere() },
    select: { ...cardSelect, content: true, seoTitle: true, seoDescription: true, categoryId: true, author: { select: { fullName: true } } },
  });
}

/** Related: same category first, then the latest others. */
export async function listRelatedPosts(post: { id: string; categoryId: string | null }, take = 3) {
  const same = post.categoryId
    ? await prisma.blogPost.findMany({
        where: { ...publicWhere(), categoryId: post.categoryId, id: { not: post.id } },
        orderBy: { publishedAt: "desc" },
        take,
        select: cardSelect,
      })
    : [];
  if (same.length >= take) return same;
  const others = await prisma.blogPost.findMany({
    where: { ...publicWhere(), id: { notIn: [post.id, ...same.map((p) => p.id)] } },
    orderBy: { publishedAt: "desc" },
    take: take - same.length,
    select: cardSelect,
  });
  return [...same, ...others];
}

// ── Admin ───────────────────────────────────────────────────────────────────

export async function adminListPosts(status: "DRAFT" | "PUBLISHED" | undefined, page: number) {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      ...pageArgs(page),
      select: { ...cardSelect, status: true, author: { select: { fullName: true } } },
    }),
    prisma.blogPost.count({ where }),
  ]);
  return toPaginated(items, total, page);
}

export async function adminGetPost(id: string) {
  return prisma.blogPost.findUnique({
    where: { id },
    select: {
      ...cardSelect,
      content: true,
      status: true,
      categoryId: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
}

/** Cover for the image route: published posts are public; drafts only for admins. */
export async function getBlogCover(id: string) {
  return prisma.blogPost.findUnique({ where: { id }, select: { coverImageKey: true, status: true, publishedAt: true } });
}
