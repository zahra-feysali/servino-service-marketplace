import type { Metadata } from "next";
import { ImageIcon, Images, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, FormUploadProgress, SubmitButton } from "@/components/shared/server-form";
import { MultiFileInput } from "@/components/shared/multi-file-input";
import { removePortfolioItemAction } from "@/features/providers/actions";
import { getProviderWorkspace } from "@/features/providers/profile-service";
import { MAX_PORTFOLIO_ITEMS } from "@/features/providers/verification";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "نمونه‌کارها" };

export default async function ProviderPortfolioPage() {
  const user = await requireRolePage("PROVIDER");
  const p = await getProviderWorkspace(user.id);

  return (
    <>
      <PageHeader title="نمونه‌کارها" description="نمونه‌کارهای شما پس از تأیید حساب در صفحه عمومی‌تان نمایش داده می‌شوند." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">افزودن نمونه‌کار</CardTitle>
        </CardHeader>
        <CardContent>
          <ServerForm endpoint="/api/provider/files" resetOnSuccess>
            <input type="hidden" name="kind" value="portfolio" />
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="title">عنوان</FieldLabel>
                <Input id="title" name="title" required maxLength={150} />
                <FormFieldError name="title" />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">توضیحات</FieldLabel>
                <Textarea id="description" name="description" rows={3} maxLength={1000} />
              </Field>
              <Field>
                <FieldLabel htmlFor="image">تصویر (اختیاری)</FieldLabel>
                <MultiFileInput id="image" name="image" rules={{ accept: ["image/jpeg", "image/png", "image/webp"], maxBytes: 5 * 1024 * 1024, maxFiles: 1 }} />
                <FieldDescription>حداکثر {MAX_PORTFOLIO_ITEMS.toLocaleString("fa-IR")} نمونه‌کار.</FieldDescription>
                <FormFieldError name="image" />
              </Field>
              <FormUploadProgress />
              <SubmitButton className="justify-self-start">افزودن</SubmitButton>
            </FieldGroup>
          </ServerForm>
        </CardContent>
      </Card>

      {p.portfolio.length === 0 ? (
        <EmptyState icon={Images} title="هنوز نمونه‌کاری ثبت نکرده‌اید" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {p.portfolio.map((item) => (
            <Card key={item.id} className="overflow-hidden pt-0">
              {item.imageKey ? (
                // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked route; not optimizable by next/image
                <img src={`/api/provider-files/portfolio/${item.id}`} alt={item.title} className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
                  <ImageIcon className="size-8" aria-hidden />
                </div>
              )}
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{item.title}</h3>
                  <ActionButton
                    action={removePortfolioItemAction.bind(null, item.id)}
                    size="icon-sm"
                    variant="ghost"
                    confirm={{ title: "حذف نمونه‌کار؟", confirmLabel: "حذف", destructive: true }}
                  >
                    <Trash2 />
                    <span className="sr-only">حذف</span>
                  </ActionButton>
                </div>
                {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
