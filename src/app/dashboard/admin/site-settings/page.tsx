import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { adminSaveSettingsAction } from "@/features/admin/actions";
import { getSiteSettings } from "@/features/admin/service";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "تنظیمات سایت" };

export default async function AdminSiteSettingsPage() {
  await requireRolePage("ADMIN");
  const s = await getSiteSettings();
  return (
    <>
      <PageHeader title="تنظیمات عمومی سایت" />
      <Card className="max-w-2xl">
        <CardContent>
          <ServerForm action={adminSaveSettingsAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">نام سایت</FieldLabel>
                <Input id="name" name="site.name" defaultValue={s["site.name"]} required />
                <FormFieldError name="site.name" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="phone">تلفن پشتیبانی</FieldLabel>
                  <Input id="phone" name="site.supportPhone" dir="ltr" className="text-left" defaultValue={s["site.supportPhone"]} />
                  <FormFieldError name="site.supportPhone" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">ایمیل پشتیبانی</FieldLabel>
                  <Input id="email" name="site.supportEmail" type="email" dir="ltr" className="text-left" defaultValue={s["site.supportEmail"]} />
                  <FormFieldError name="site.supportEmail" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="expiry">مهلت دریافت پیشنهاد برای درخواست‌ها (روز)</FieldLabel>
                <Input id="expiry" name="requests.defaultExpiryDays" type="number" min={1} max={90} dir="ltr" defaultValue={s["requests.defaultExpiryDays"]} />
                <FieldDescription>برای درخواست‌های جدید اعمال می‌شود.</FieldDescription>
                <FormFieldError name="requests.defaultExpiryDays" />
              </Field>
              <SubmitButton className="justify-self-start">ذخیره</SubmitButton>
            </FieldGroup>
          </ServerForm>
        </CardContent>
      </Card>
    </>
  );
}
