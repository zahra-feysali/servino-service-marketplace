import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FolderTree, Newspaper, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterLinks, pickParam } from "@/components/shared/filter-links";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { setBlogPostStatusAction } from "@/features/blog/actions";
import { adminListPosts } from "@/features/blog/queries";
import { BLOG_STATUS_META } from "@/features/blog/schemas";
import { requireRolePage } from "@/lib/authz";
import { parsePage } from "@/lib/pagination";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "مدیریت بلاگ" };
const STATUSES = ["PUBLISHED", "DRAFT"] as const;
const BASE = "/dashboard/admin/blog";

export default async function AdminBlogPage({ searchParams }: PageProps<"/dashboard/admin/blog">) {
  await requireRolePage("ADMIN");
  const sp = await searchParams;
  const status = pickParam(sp.status, STATUSES);
  const posts = await adminListPosts(status, parsePage(sp.page));

  return (
    <>
      <PageHeader
        icon={Newspaper}
        title="مدیریت بلاگ"
        description="نوشتن، ویرایش، انتشار و حذف مقاله‌های مجله"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`${BASE}/categories`}>
                <FolderTree />
                دسته‌بندی‌ها
              </Link>
            </Button>
            <Button asChild>
              <Link href={`${BASE}/new`}>
                <Plus />
                مقاله جدید
              </Link>
            </Button>
          </div>
        }
      />
      <FilterLinks
        basePath={BASE}
        param="status"
        current={status}
        options={[{ value: "", label: "همه" }, ...STATUSES.map((s) => ({ value: s, label: BLOG_STATUS_META[s].label }))]}
      />
      {posts.items.length === 0 ? (
        <EmptyState icon={Newspaper} title="مقاله‌ای وجود ندارد" description="اولین مقاله را بنویسید." />
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">عنوان</TableHead>
                <TableHead className="text-start">دسته‌بندی</TableHead>
                <TableHead className="text-start">وضعیت</TableHead>
                <TableHead className="text-start">تاریخ انتشار</TableHead>
                <TableHead className="text-start">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-72">
                    <Link href={`${BASE}/${p.id}`} className="line-clamp-2 font-medium whitespace-normal hover:text-primary">
                      {p.title}
                    </Link>
                  </TableCell>
                  <TableCell>{p.category?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={BLOG_STATUS_META[p.status].variant}>{BLOG_STATUS_META[p.status].label}</Badge>
                  </TableCell>
                  <TableCell>{p.publishedAt ? formatDate(p.publishedAt) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`${BASE}/${p.id}`}>
                          <Pencil />
                          ویرایش
                        </Link>
                      </Button>
                      {p.status === "PUBLISHED" ? (
                        <>
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/blog/${p.slug}`} target="_blank">
                              <ExternalLink />
                              مشاهده
                            </Link>
                          </Button>
                          <ActionButton action={setBlogPostStatusAction.bind(null, p.id, "DRAFT")} size="sm" variant="ghost">
                            لغو انتشار
                          </ActionButton>
                        </>
                      ) : (
                        <ActionButton action={setBlogPostStatusAction.bind(null, p.id, "PUBLISHED")} size="sm" variant="ghost">
                          انتشار
                        </ActionButton>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationNav basePath={BASE} params={sp} page={posts.page} totalPages={posts.totalPages} total={posts.total} />
    </>
  );
}
