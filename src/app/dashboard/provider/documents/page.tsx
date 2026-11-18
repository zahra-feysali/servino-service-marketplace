import type { Metadata } from "next";
import { FileText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { removeDocumentAction } from "@/features/providers/actions";
import { getProviderWorkspace } from "@/features/providers/profile-service";
import { DOCUMENT_STATUS_META, DOCUMENT_TYPE_LABELS, MAX_DOCUMENTS } from "@/features/providers/verification";
import { requireRolePage } from "@/lib/authz";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "مدارک و گواهی‌ها" };

export default async function ProviderDocumentsPage() {
  const user = await requireRolePage("PROVIDER");
  const p = await getProviderWorkspace(user.id);

  return (
    <>
      <PageHeader title="مدارک و گواهی‌ها" description="مدارک فقط برای شما و تیم بررسی سروینو قابل مشاهده است." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">بارگذاری مدرک</CardTitle>
          <CardDescription>تصویر یا PDF تا ۵ مگابایت. حداکثر {MAX_DOCUMENTS.toLocaleString("fa-IR")} مدرک.</CardDescription>
        </CardHeader>
        <CardContent>
          <ServerForm endpoint="/api/provider/files" resetOnSuccess>
            <input type="hidden" name="kind" value="document" />
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="type">نوع مدرک</FieldLabel>
                  <NativeSelect id="type" name="type" className="w-full" defaultValue="NATIONAL_ID">
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => (
                      <NativeSelectOption key={v} value={v}>
                        {l}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel htmlFor="title">عنوان</FieldLabel>
                  <Input id="title" name="title" required maxLength={150} placeholder="مثلاً: گواهی فنی‌وحرفه‌ای" />
                  <FormFieldError name="title" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="file">فایل</FieldLabel>
                <Input id="file" name="file" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" />
                <FieldDescription>JPEG، PNG، WebP یا PDF</FieldDescription>
                <FormFieldError name="file" />
              </Field>
              <SubmitButton className="justify-self-start">بارگذاری</SubmitButton>
            </FieldGroup>
          </ServerForm>
        </CardContent>
      </Card>

      {p.documents.length === 0 ? (
        <EmptyState icon={FileText} title="مدرکی بارگذاری نشده است" description="برای ارسال پروفایل جهت تأیید، حداقل یک مدرک لازم است." />
      ) : (
        <div className="rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">عنوان</TableHead>
                <TableHead className="text-start">نوع</TableHead>
                <TableHead className="text-start">وضعیت</TableHead>
                <TableHead className="text-start">تاریخ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.documents.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>
                    <a href={`/api/provider-files/document/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                      {d.title}
                    </a>
                    {d.reviewNote ? <span className="block text-xs text-muted-foreground">{d.reviewNote}</span> : null}
                  </TableCell>
                  <TableCell>{DOCUMENT_TYPE_LABELS[d.type]}</TableCell>
                  <TableCell>
                    <Badge variant={DOCUMENT_STATUS_META[d.status].variant}>{DOCUMENT_STATUS_META[d.status].label}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(d.createdAt)}</TableCell>
                  <TableCell>
                    {d.status !== "APPROVED" ? (
                      <ActionButton
                        action={removeDocumentAction.bind(null, d.id)}
                        size="icon-sm"
                        variant="ghost"
                        confirm={{ title: "حذف مدرک؟", confirmLabel: "حذف", destructive: true }}
                      >
                        <Trash2 />
                        <span className="sr-only">حذف</span>
                      </ActionButton>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
