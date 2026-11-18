import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/page-header";
import { deleteBlogPostAction } from "@/features/blog/actions";
import { PostForm } from "@/features/blog/components/post-form";
import { adminGetPost, listBlogCategories } from "@/features/blog/queries";
import { BLOG_STATUS_META } from "@/features/blog/schemas";
import { requireRolePage } from "@/lib/authz";
import { isUuid } from "@/lib/db-locks";

export const metadata: Metadata = { title: "ویرایش مقاله" };

export default async function EditBlogPostPage({ params }: PageProps<"/dashboard/admin/blog/[id]">) {
  await requireRolePage("ADMIN");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [post, categories] = await Promise.all([adminGetPost(id), listBlogCategories()]);
  if (!post) notFound();

  return (
    <>
      <PageHeader
        title={post.title}
        description={`ویرایش مقاله — وضعیت: ${BLOG_STATUS_META[post.status].label}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {post.status === "PUBLISHED" ? (
              <Button asChild variant="outline">
                <Link href={`/blog/${post.slug}`} target="_blank">
                  <ExternalLink />
                  مشاهده در سایت
                </Link>
              </Button>
            ) : null}
            <ActionButton
              action={deleteBlogPostAction.bind(null, post.id)}
              variant="outline"
              confirm={{ title: `حذف «${post.title}»؟`, description: "مقاله و تصویر آن برای همیشه حذف می‌شوند.", confirmLabel: "حذف مقاله", destructive: true }}
            >
              <Trash2 />
              حذف
            </ActionButton>
          </div>
        }
      />
      <PostForm post={post} categories={categories} />
    </>
  );
}
