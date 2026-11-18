import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Newspaper } from "lucide-react";
import { cn } from "cn";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { BlogPostCard } from "@/features/blog/components/blog-ui";
import { listBlogCategories, listPublishedPosts } from "@/features/blog/queries";
import { parsePage } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "مجله سروینو",
  description: "راهنماها و نکته‌های کاربردی نگهداری منزل، تعمیرات، نظافت و اسباب‌کشی از متخصصان سروینو.",
};

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  await connection();
  const sp = await searchParams;
  const categories = await listBlogCategories();
  const active = typeof sp.category === "string" ? categories.find((c) => c.slug === sp.category) : undefined;
  const posts = await listPublishedPosts({ categorySlug: active?.slug }, parsePage(sp.page));

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 lg:py-14">
      <header className="max-w-2xl space-y-2">
        <h1 className="text-3xl font-extrabold">مجله سروینو</h1>
        <p className="leading-8 text-muted-foreground">
          {active?.description ?? "راهنماهای کاربردی برای نگهداری خانه، انتخاب متخصص و صرفه‌جویی در هزینه‌ها."}
        </p>
      </header>

      {categories.length ? (
        <nav aria-label="دسته‌بندی مقاله‌ها" className="-mx-4 overflow-x-auto px-4 pb-1">
          <ul className="flex w-max gap-2">
            {[{ slug: "", name: "همه مقاله‌ها", postCount: -1 }, ...categories].map((c) => {
              const isActive = (c.slug || undefined) === active?.slug;
              return (
                <li key={c.slug || "all"}>
                  <Link
                    href={c.slug ? `/blog?category=${c.slug}` : "/blog"}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors",
                      isActive ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                    )}
                  >
                    {c.name}
                    {c.postCount >= 0 ? <span className="text-xs opacity-70">{c.postCount.toLocaleString("fa-IR")}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {posts.items.length === 0 ? (
        <EmptyState icon={Newspaper} title="هنوز مقاله‌ای منتشر نشده است" description="به‌زودی راهنماهای تازه در این بخش منتشر می‌شود." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.items.map((p, i) => (
            <BlogPostCard key={p.id} post={p} priority={i < 3} />
          ))}
        </div>
      )}
      <PaginationNav basePath="/blog" params={sp} page={posts.page} totalPages={posts.totalPages} total={posts.total} />
    </div>
  );
}
