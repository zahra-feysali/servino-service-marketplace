import type { Metadata } from "next";
import Link from "next/link";
import { FolderPlus, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ServiceIcon } from "@/components/shared/service-icon";
import { deleteCategoryAction, deleteServiceAction } from "@/features/catalog/admin-actions";
import { getAdminCatalog, getCategoryOptions, type AdminCatalog } from "@/features/catalog/admin-queries";
import { CategoryDialog } from "@/features/catalog/components/category-dialog";
import { NewServiceDialog } from "@/features/catalog/components/new-service-dialog";
import { requireRolePage } from "@/lib/authz";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "خدمات و فرم‌ها" };

type Service = AdminCatalog[number]["services"][number];
type CategoryLike = { id: string; name: string; slug: string; description: string | null; icon: string | null; isActive: boolean; sortOrder: number };

function ServiceRows({ services }: { services: Service[] }) {
  if (services.length === 0) return <p className="py-2 text-sm text-muted-foreground">خدمتی ثبت نشده است.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {services.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{s.name}</span>
            {!s.isActive ? <Badge variant="outline">غیرفعال</Badge> : null}
            <span className="text-xs text-muted-foreground">
              {formatNumber(s._count.formFields)} فیلد · {formatNumber(s._count.requests)} درخواست · {formatNumber(s._count.providerServices)} متخصص
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/admin/catalog/services/${s.id}`}>
                <Settings2 />
                ویرایش و فرم‌ساز
              </Link>
            </Button>
            <ActionButton
              action={deleteServiceAction.bind(null, s.id)}
              size="icon-sm"
              variant="ghost"
              confirm={{ title: `حذف خدمت «${s.name}»؟`, description: "فقط خدمتی که درخواست یا متخصص ندارد قابل حذف است.", confirmLabel: "حذف", destructive: true }}
            >
              <Trash2 />
              <span className="sr-only">حذف</span>
            </ActionButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CategoryActions({ category, parentId, parentOptions }: { category: CategoryLike; parentId: string | null; parentOptions: { id: string; name: string }[] }) {
  return (
    <div className="flex items-center gap-1">
      <CategoryDialog
        title={`ویرایش «${category.name}»`}
        categoryId={category.id}
        parentOptions={parentOptions}
        initial={{
          name: category.name,
          slug: category.slug,
          description: category.description ?? "",
          icon: (category.icon ?? "") as never,
          parentId: parentId ?? "",
          isActive: category.isActive,
          sortOrder: category.sortOrder,
        }}
        trigger={
          <Button size="icon-sm" variant="ghost" aria-label="ویرایش دسته‌بندی">
            <Pencil />
          </Button>
        }
      />
      <ActionButton
        action={deleteCategoryAction.bind(null, category.id)}
        size="icon-sm"
        variant="ghost"
        confirm={{ title: `حذف «${category.name}»؟`, description: "فقط دسته‌بندی خالی قابل حذف است.", confirmLabel: "حذف", destructive: true }}
      >
        <Trash2 />
        <span className="sr-only">حذف</span>
      </ActionButton>
    </div>
  );
}

export default async function AdminCatalogPage() {
  await requireRolePage("ADMIN");
  const [catalog, categoryOptions] = await Promise.all([getAdminCatalog(), getCategoryOptions()]);
  const parentOptions = catalog.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader
        title="خدمات و فرم‌ها"
        description="مدیریت دسته‌بندی‌ها، زیر‌دسته‌ها، خدمات و فرم‌های پویای درخواست"
        actions={
          <>
            <CategoryDialog
              title="دسته‌بندی جدید"
              parentOptions={parentOptions}
              trigger={
                <Button variant="outline">
                  <FolderPlus />
                  دسته‌بندی جدید
                </Button>
              }
            />
            <NewServiceDialog
              categoryOptions={categoryOptions}
              trigger={
                <Button disabled={categoryOptions.length === 0}>
                  <Plus />
                  خدمت جدید
                </Button>
              }
            />
          </>
        }
      />

      {catalog.length === 0 ? (
        <EmptyState title="هنوز دسته‌بندی‌ای ندارید" description="ابتدا یک دسته‌بندی اصلی بسازید." />
      ) : (
        <div className="space-y-4">
          {catalog.map((category) => (
            <Card key={category.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ServiceIcon name={category.icon} className="size-5 text-primary" />
                  {category.name}
                  {!category.isActive ? <Badge variant="outline">غیرفعال</Badge> : null}
                  <span className="text-xs font-normal text-muted-foreground ltr-nums">/{category.slug}</span>
                </CardTitle>
                <CategoryActions category={category} parentId={null} parentOptions={parentOptions} />
              </CardHeader>
              <CardContent className="space-y-4">
                <ServiceRows services={category.services} />
                {category.children.map((sub) => (
                  <div key={sub.id} className="space-y-2 border-s-2 border-secondary ps-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        {sub.name}
                        {!sub.isActive ? <Badge variant="outline">غیرفعال</Badge> : null}
                      </h3>
                      <div className="flex items-center gap-1">
                        <NewServiceDialog
                          categoryOptions={categoryOptions}
                          defaultCategoryId={sub.id}
                          trigger={
                            <Button size="sm" variant="ghost">
                              <Plus />
                              خدمت
                            </Button>
                          }
                        />
                        <CategoryActions category={sub} parentId={category.id} parentOptions={parentOptions} />
                      </div>
                    </div>
                    <ServiceRows services={sub.services} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
