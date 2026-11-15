import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, CheckCircle2, PauseCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { adminSetUserStatusAction, adminUpdateUserAction } from "@/features/admin/actions";
import { ROLE_LABELS } from "@/features/auth/rbac";
import { adminGetUser } from "@/features/users/admin-service";
import { USER_STATUS_LABELS } from "@/features/users/labels";
import { isUuid } from "@/lib/db-locks";
import { requireRolePage } from "@/lib/authz";
import { formatDate, formatDateTime, formatPrice, toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "حساب کاربر" };

export default async function AdminUserPage({ params }: PageProps<"/dashboard/admin/users/[id]">) {
  const admin = await requireRolePage("ADMIN");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const u = await adminGetUser(id);
  if (!u) notFound();
  const editable = u.role !== "ADMIN" && u.id !== admin.id;

  return (
    <>
      <PageHeader
        title={u.fullName}
        description={`${ROLE_LABELS[u.role]} · عضویت ${formatDate(u.createdAt)}${u.lastLoginAt ? ` · آخرین ورود ${formatDateTime(u.lastLoginAt)}` : ""}`}
        actions={
          <>
            <Badge variant={u.status === "ACTIVE" ? "secondary" : "destructive"}>{USER_STATUS_LABELS[u.status]}</Badge>
            {u.providerProfile ? (
              <Button asChild size="sm">
                <Link href={`/dashboard/admin/providers/${u.providerProfile.id}`}>پروفایل حرفه‌ای</Link>
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ویرایش اطلاعات</CardTitle>
          </CardHeader>
          <CardContent>
            <ServerForm action={adminUpdateUserAction.bind(null, u.id)}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="fullName">نام و نام خانوادگی</FieldLabel>
                  <Input id="fullName" name="fullName" defaultValue={u.fullName} required />
                  <FormFieldError name="fullName" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="phone">موبایل</FieldLabel>
                  <Input id="phone" name="phone" defaultValue={u.phone} dir="ltr" className="text-left" required />
                  <FormFieldError name="phone" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">ایمیل</FieldLabel>
                  <Input id="email" name="email" type="email" defaultValue={u.email ?? ""} dir="ltr" className="text-left" />
                  <FormFieldError name="email" />
                </Field>
                <SubmitButton className="justify-self-start">ذخیره</SubmitButton>
              </FieldGroup>
            </ServerForm>
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">وضعیت حساب</CardTitle>
              <CardDescription>کاربر غیرفعال یا مسدود نمی‌تواند وارد شود و دسترسی فعلی او بلافاصله قطع می‌شود.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {!editable ? (
                <p className="text-sm text-muted-foreground">وضعیت حساب مدیران از این بخش قابل تغییر نیست.</p>
              ) : (
                <>
                  {u.status !== "ACTIVE" ? (
                    <ActionButton action={adminSetUserStatusAction.bind(null, u.id, "ACTIVE")} confirm={{ title: "فعال‌سازی حساب؟", confirmLabel: "فعال‌سازی" }}>
                      <CheckCircle2 />
                      فعال‌سازی
                    </ActionButton>
                  ) : null}
                  {u.status !== "INACTIVE" ? (
                    <ActionButton action={adminSetUserStatusAction.bind(null, u.id, "INACTIVE")} variant="outline" confirm={{ title: "غیرفعال‌سازی حساب؟", confirmLabel: "غیرفعال‌سازی" }}>
                      <PauseCircle />
                      غیرفعال‌سازی
                    </ActionButton>
                  ) : null}
                  {u.status !== "SUSPENDED" ? (
                    <ActionButton action={adminSetUserStatusAction.bind(null, u.id, "SUSPENDED")} variant="destructive" confirm={{ title: "مسدودسازی حساب؟", confirmLabel: "مسدودسازی", destructive: true }}>
                      <Ban />
                      مسدودسازی
                    </ActionButton>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">خلاصه</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <p>درخواست‌ها: {toPersianDigits(u._count.requests)}</p>
              <p>سفارش‌ها (مشتری): {toPersianDigits(u._count.customerOrders)}</p>
              <p>تیکت‌ها: {toPersianDigits(u._count.tickets)}</p>
              <p>پرداخت‌ها: {toPersianDigits(u._count.payments)}</p>
              <p>موجودی کیف پول: {formatPrice(u.wallet?.balance ?? 0)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
