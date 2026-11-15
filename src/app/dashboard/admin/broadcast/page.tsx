import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { adminBroadcastAction } from "@/features/admin/actions";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "ارسال اعلان" };

export default async function AdminBroadcastPage() {
  await requireRolePage("ADMIN");
  return (
    <>
      <PageHeader title="ارسال اعلان عمومی" description="اعلان درون‌برنامه‌ای برای کاربران فعال" />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">اعلان جدید</CardTitle>
          <CardDescription>اعلان در بخش اعلان‌های کاربران نمایش داده می‌شود.</CardDescription>
        </CardHeader>
        <CardContent>
          <ServerForm action={adminBroadcastAction} resetOnSuccess>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="audience">گیرندگان</FieldLabel>
                <NativeSelect id="audience" name="audience" className="w-full" defaultValue="ALL">
                  <NativeSelectOption value="ALL">همه مشتریان و متخصصان</NativeSelectOption>
                  <NativeSelectOption value="CUSTOMER">فقط مشتریان</NativeSelectOption>
                  <NativeSelectOption value="PROVIDER">فقط متخصصان</NativeSelectOption>
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="title">عنوان</FieldLabel>
                <Input id="title" name="title" required maxLength={200} />
                <FormFieldError name="title" />
              </Field>
              <Field>
                <FieldLabel htmlFor="body">متن</FieldLabel>
                <Textarea id="body" name="body" rows={4} maxLength={1000} />
                <FormFieldError name="body" />
              </Field>
              <SubmitButton className="justify-self-start">ارسال</SubmitButton>
            </FieldGroup>
          </ServerForm>
        </CardContent>
      </Card>
    </>
  );
}
