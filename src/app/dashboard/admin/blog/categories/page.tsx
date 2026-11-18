import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FolderTree, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { deleteBlogCategoryAction, saveBlogCategoryAction } from "@/features/blog/actions";
import { listBlogCategories } from "@/features/blog/queries";
import { requireRolePage } from "@/lib/authz";
import { toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "دسته‌بندی‌های بلاگ" };

function CategoryFields({ c }: { c?: { name: string; slug: string; description: string | null; sortOrder: number } }) {
  const p = c ? "e" : "n";
  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${p}-name-${c?.slug ?? ""}`}>نام</FieldLabel>
          <Input id={`${p}-name-${c?.slug ?? ""}`} name="name" required maxLength={80} defaultValue={c?.name} />
          <FormFieldError name="name" />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${p}-slug-${c?.slug ?? ""}`}>نامک</FieldLabel>
          <Input id={`${p}-slug-${c?.slug ?? ""}`} name="slug" required dir="ltr" className="text-end" defaultValue={c?.slug} placeholder="home-maintenance" />
          <FormFieldError name="slug" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field>
          <FieldLabel htmlFor={`${p}-desc-${c?.slug ?? ""}`}>توضیح کوتاه</FieldLabel>
          <Input id={`${p}-desc-${c?.slug ?? ""}`} name="description" maxLength={300} defaultValue={c?.description ?? ""} />
          <FormFieldError name="description" />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${p}-sort-${c?.slug ?? ""}`}>ترتیب</FieldLabel>
          <Input id={`${p}-sort-${c?.slug ?? ""}`} name="sortOrder" type="number" min={0} max={999} dir="ltr" defaultValue={c?.sortOrder ?? 0} />
        </Field>
      </div>
    </FieldGroup>
  );
}

export default async function BlogCategoriesPage() {
  await requireRolePage("ADMIN");
  const categories = await listBlogCategories();
  return (
    <>
      <PageHeader
        icon={FolderTree}
        title="دسته‌بندی‌های بلاگ"
        description="حذف دسته‌بندی، مقاله‌ها را حذف نمی‌کند؛ آن‌ها بدون دسته‌بندی می‌شوند."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/admin/blog">
              <ArrowRight />
              بازگشت به مقاله‌ها
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">دسته‌بندی جدید</CardTitle>
        </CardHeader>
        <CardContent>
          <ServerForm action={saveBlogCategoryAction.bind(null, null)} resetOnSuccess className="space-y-4">
            <CategoryFields />
            <SubmitButton>افزودن</SubmitButton>
          </ServerForm>
        </CardContent>
      </Card>
      {categories.length === 0 ? (
        <EmptyState icon={FolderTree} title="هنوز دسته‌بندی‌ای ندارید" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {categories.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {c.name} <span className="text-xs font-normal text-muted-foreground">({toPersianDigits(c.postCount)} مقاله منتشرشده)</span>
                </CardTitle>
                <ActionButton
                  action={deleteBlogCategoryAction.bind(null, c.id)}
                  size="sm"
                  variant="ghost"
                  confirm={{ title: `حذف دسته‌بندی «${c.name}»؟`, description: "مقاله‌های این دسته‌بندی حذف نمی‌شوند.", confirmLabel: "حذف", destructive: true }}
                >
                  <Trash2 />
                  حذف
                </ActionButton>
              </CardHeader>
              <CardContent>
                <ServerForm action={saveBlogCategoryAction.bind(null, c.id)} className="space-y-4">
                  <CategoryFields c={c} />
                  <SubmitButton variant="outline">ذخیره تغییرات</SubmitButton>
                </ServerForm>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
