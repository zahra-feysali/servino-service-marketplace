import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { PostForm } from "@/features/blog/components/post-form";
import { listBlogCategories } from "@/features/blog/queries";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "مقاله جدید" };

export default async function NewBlogPostPage() {
  await requireRolePage("ADMIN");
  const categories = await listBlogCategories();
  return (
    <>
      <PageHeader title="مقاله جدید" description="پس از ذخیره می‌توانید مقاله را ویرایش یا منتشر کنید." />
      <PostForm categories={categories} />
    </>
  );
}
