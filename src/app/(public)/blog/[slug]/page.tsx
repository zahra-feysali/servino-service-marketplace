import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlogCover, BlogPostCard, MarkupView, PostMeta } from "@/features/blog/components/blog-ui";
import { SLUG_REGEX } from "@/features/blog/markup";
import { getPublishedPost, listRelatedPosts } from "@/features/blog/queries";

type Props = PageProps<"/blog/[slug]">;

async function load(slug: string) {
  return SLUG_REGEX.test(slug) ? getPublishedPost(slug) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await load(slug);
  if (!post) return { title: "مقاله یافت نشد" };
  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.excerpt;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      publishedTime: post.publishedAt?.toISOString(),
      images: post.coverImagePath ? [{ url: post.coverImagePath, alt: post.coverAlt ?? post.title }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  await connection();
  const { slug } = await params;
  const post = await load(slug);
  if (!post) notFound();
  const related = await listRelatedPosts({ id: post.id, categoryId: post.categoryId });

  return (
    <article className="pb-16">
      <header className="mx-auto max-w-3xl space-y-4 px-4 pt-8 lg:pt-12">
        <nav aria-label="مسیر" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          <Link href="/blog" className="hover:text-primary">
            مجله
          </Link>
          {post.category ? (
            <>
              <ChevronLeft className="size-3.5" aria-hidden />
              <Link href={`/blog?category=${post.category.slug}`} className="hover:text-primary">
                {post.category.name}
              </Link>
            </>
          ) : null}
        </nav>
        <h1 className="text-2xl leading-[1.6] font-extrabold text-balance sm:text-3xl">{post.title}</h1>
        <p className="text-lg leading-8 text-muted-foreground">{post.excerpt}</p>
        <PostMeta post={post} />
      </header>

      <div className="mx-auto mt-8 max-w-4xl px-4">
        <BlogCover post={post} sizes="(min-width: 1024px) 896px, 100vw" priority className="aspect-[16/9] rounded-3xl shadow-soft" />
      </div>

      <div className="mx-auto mt-10 max-w-3xl px-4">
        <MarkupView content={post.content} />
        <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl border bg-secondary/50 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-bold">برای انجام این کار به متخصص نیاز دارید؟</p>
            <p className="text-sm text-muted-foreground">درخواست خود را ثبت کنید تا متخصصان تأییدشده شهرتان پیشنهاد بدهند.</p>
          </div>
          <Button asChild>
            <Link href="/services">
              ثبت درخواست
              <ArrowLeft />
            </Link>
          </Button>
        </div>
      </div>

      {related.length ? (
        <section className="mx-auto mt-16 max-w-6xl space-y-6 px-4" aria-labelledby="related-title">
          <h2 id="related-title" className="text-xl font-bold">
            مقاله‌های مرتبط
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <BlogPostCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
