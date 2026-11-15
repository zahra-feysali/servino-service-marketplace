import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowRight, ArrowUp, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { deleteFieldAction, moveFieldAction, setFieldActiveAction } from "@/features/catalog/admin-actions";
import { getAdminService, getCategoryOptions } from "@/features/catalog/admin-queries";
import { FieldDialog } from "@/features/catalog/components/field-dialog";
import { ServiceForm } from "@/features/catalog/components/service-form";
import { FIELD_TYPE_LABELS } from "@/features/forms/definitions";
import { isUuid } from "@/lib/db-locks";
import { requireRolePage } from "@/lib/authz";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "ویرایش خدمت و فرم‌ساز" };

export default async function AdminServicePage({ params }: PageProps<"/dashboard/admin/catalog/services/[id]">) {
  await requireRolePage("ADMIN");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [service, categoryOptions] = await Promise.all([getAdminService(id), getCategoryOptions()]);
  if (!service) notFound();

  const fields = service.formFields;

  return (
    <>
      <PageHeader
        title={service.name}
        description={`${service.category.name} · نسخه فرم ${formatNumber(service.formVersion)} · ${formatNumber(service._count.requests)} درخواست`}
        actions={
          <>
            {service.isActive ? (
              <Button asChild variant="outline">
                <Link href={`/services/${service.slug}`} target="_blank">
                  <Eye />
                  مشاهده در سایت
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="ghost">
              <Link href="/dashboard/admin/catalog">
                <ArrowRight />
                بازگشت
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">اطلاعات خدمت</CardTitle>
          </CardHeader>
          <CardContent>
            <ServiceForm
              formId="edit-service"
              serviceId={service.id}
              categoryOptions={categoryOptions}
              initial={{
                categoryId: service.categoryId,
                name: service.name,
                slug: service.slug,
                shortDescription: service.shortDescription ?? "",
                description: service.description ?? "",
                icon: (service.icon ?? "") as never,
                isActive: service.isActive,
                sortOrder: service.sortOrder,
              }}
            />
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="text-base">فرم‌ساز درخواست</CardTitle>
              <CardDescription>فیلدهای فعال به ترتیب زیر در فرم ثبت درخواست مشتری نمایش داده می‌شوند.</CardDescription>
            </div>
            <FieldDialog
              serviceId={service.id}
              trigger={
                <Button size="sm">
                  <Plus />
                  فیلد جدید
                </Button>
              }
            />
          </CardHeader>
          <CardContent>
            {fields.length === 0 ? (
              <EmptyState title="این فرم هنوز فیلدی ندارد" description="مشتری فقط شهر، نشانی و توضیحات عمومی را وارد می‌کند." />
            ) : (
              <ol className="divide-y rounded-lg border">
                {fields.map((f, i) => (
                  <li key={f.id} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 ${f.isActive ? "" : "opacity-60"}`}>
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {f.label}
                        <Badge variant="secondary">{FIELD_TYPE_LABELS[f.type]}</Badge>
                        {f.isRequired ? <Badge>الزامی</Badge> : null}
                        {!f.isActive ? <Badge variant="outline">غیرفعال</Badge> : null}
                      </p>
                      <p className="text-xs text-muted-foreground ltr-nums">{f.name}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <ActionButton action={moveFieldAction.bind(null, service.id, f.id, "up")} size="icon-sm" variant="ghost" className={i === 0 ? "invisible" : ""}>
                        <ArrowUp />
                        <span className="sr-only">بالا</span>
                      </ActionButton>
                      <ActionButton
                        action={moveFieldAction.bind(null, service.id, f.id, "down")}
                        size="icon-sm"
                        variant="ghost"
                        className={i === fields.length - 1 ? "invisible" : ""}
                      >
                        <ArrowDown />
                        <span className="sr-only">پایین</span>
                      </ActionButton>
                      <ActionButton action={setFieldActiveAction.bind(null, service.id, f.id, !f.isActive)} size="icon-sm" variant="ghost">
                        {f.isActive ? <EyeOff /> : <Eye />}
                        <span className="sr-only">{f.isActive ? "غیرفعال کردن" : "فعال کردن"}</span>
                      </ActionButton>
                      <FieldDialog
                        serviceId={service.id}
                        field={f}
                        trigger={
                          <Button size="icon-sm" variant="ghost" aria-label="ویرایش فیلد">
                            <Pencil />
                          </Button>
                        }
                      />
                      <ActionButton
                        action={deleteFieldAction.bind(null, service.id, f.id)}
                        size="icon-sm"
                        variant="ghost"
                        confirm={{
                          title: `حذف فیلد «${f.label}»؟`,
                          description: "درخواست‌های قبلی تحت تأثیر قرار نمی‌گیرند. برای پنهان‌کردن موقت، فیلد را غیرفعال کنید.",
                          confirmLabel: "حذف",
                          destructive: true,
                        }}
                      >
                        <Trash2 />
                        <span className="sr-only">حذف</span>
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
