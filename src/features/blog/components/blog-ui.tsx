import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, ImageIcon } from "lucide-react";
import { cn } from "cn";
import { parseMarkup, type Inline } from "@/features/blog/markup";
import { coverSrc, type BlogCard } from "@/features/blog/queries";
import { formatDate, toPersianDigits } from "@/lib/utils";

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Renders blog markup as React elements (text only — no raw HTML). */
export function MarkupView({ content, className }: { content: string; className?: string }) {
  const blocks = parseMarkup(content);
  return (
    <div className={cn("space-y-5 text-[1.02rem] leading-8 text-foreground/90", className)}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2 key={i} className="pt-4 text-xl font-bold text-foreground sm:text-2xl">
                <InlineText parts={b.content} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="pt-2 text-lg font-bold text-foreground">
                <InlineText parts={b.content} />
              </h3>
            );
          case "quote":
            return (
              <blockquote key={i} className="rounded-e-xl border-s-4 border-primary bg-primary/5 px-4 py-3 text-foreground">
                <InlineText parts={b.content} />
              </blockquote>
            );
          case "ul":
          case "ol": {
            const List = b.type === "ul" ? "ul" : "ol";
            return (
              <List key={i} className={cn("space-y-2 ps-6", b.type === "ul" ? "list-disc" : "list-decimal", "marker:text-primary")}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <InlineText parts={item} />
                  </li>
                ))}
              </List>
            );
          }
          default:
            return (
              <p key={i}>
                <InlineText parts={b.content} />
              </p>
            );
        }
      })}
    </div>
  );
}

/** Cover image: bundled static files are optimised by next/image; uploaded covers stream from the private route. */
export function BlogCover({
  post,
  sizes,
  priority,
  className,
}: {
  post: Pick<BlogCard, "id" | "coverImageKey" | "coverImagePath" | "coverAlt" | "updatedAt" | "title">;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = coverSrc(post);
  if (!src) {
    return (
      <div className={cn("grid place-items-center bg-gradient-to-br from-primary/15 to-highlight/20 text-primary", className)}>
        <ImageIcon className="size-8 opacity-60" aria-hidden />
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <Image
        src={src}
        alt={post.coverAlt ?? post.title}
        fill
        sizes={sizes}
        priority={priority}
        unoptimized={src.startsWith("/api/")}
        className="object-cover"
      />
    </div>
  );
}

export function PostMeta({ post, className }: { post: Pick<BlogCard, "publishedAt" | "readingMinutes">; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {post.publishedAt ? (
        <span className="flex items-center gap-1">
          <CalendarDays className="size-3.5" aria-hidden />
          <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time>
        </span>
      ) : null}
      <span className="flex items-center gap-1">
        <Clock className="size-3.5" aria-hidden />
        {toPersianDigits(post.readingMinutes)} دقیقه مطالعه
      </span>
    </p>
  );
}

export function BlogPostCard({ post, priority }: { post: BlogCard; priority?: boolean }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lifted">
      <Link href={`/blog/${post.slug}`} className="block" tabIndex={-1} aria-hidden>
        <BlogCover post={post} sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw" priority={priority} className="aspect-[16/10]" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        {post.category ? (
          <Link href={`/blog?category=${post.category.slug}`} className="w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/15">
            {post.category.name}
          </Link>
        ) : null}
        <h3 className="text-lg leading-8 font-bold text-balance">
          <Link href={`/blog/${post.slug}`} className="hover:text-primary">
            {post.title}
          </Link>
        </h3>
        <p className="line-clamp-3 text-sm leading-7 text-muted-foreground">{post.excerpt}</p>
        <PostMeta post={post} className="mt-auto pt-2" />
      </div>
    </article>
  );
}
