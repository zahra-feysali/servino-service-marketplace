import type { Metadata } from "next";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import { addSkillAction, removeSkillAction, updateProviderProfileAction } from "@/features/providers/actions";
import { ProfileChecklist } from "@/features/providers/components/profile-checklist";
import { getProviderWorkspace } from "@/features/providers/profile-service";
import { MAX_SKILLS } from "@/features/providers/verification";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "پروفایل حرفه‌ای" };

export default async function ProviderProfilePage() {
  const user = await requireRolePage("PROVIDER");
  const p = await getProviderWorkspace(user.id);

  return (
    <>
      <PageHeader title="پروفایل حرفه‌ای" description="اطلاعاتی که مشتریان در صفحه شما می‌بینند" />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">اطلاعات حرفه‌ای</CardTitle>
            </CardHeader>
            <CardContent>
              <ServerForm action={updateProviderProfileAction}>
                <FieldGroup>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor="displayName">نام نمایشی</FieldLabel>
                      <Input id="displayName" name="displayName" defaultValue={p.displayName} required maxLength={120} />
                      <FormFieldError name="displayName" />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="yearsOfExperience">سابقه کار (سال)</FieldLabel>
                      <Input id="yearsOfExperience" name="yearsOfExperience" type="number" min={0} max={70} dir="ltr" defaultValue={p.yearsOfExperience} />
                      <FormFieldError name="yearsOfExperience" />
                    </Field>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="bio">معرفی و توضیحات</FieldLabel>
                    <Textarea id="bio" name="bio" rows={6} defaultValue={p.bio ?? ""} maxLength={3000} />
                    <FieldDescription>تجربه، تخصص‌ها، تجهیزات و ضمانت خدمات خود را بنویسید (حداقل ۳۰ کاراکتر برای تأیید).</FieldDescription>
                    <FormFieldError name="bio" />
                  </Field>
                  <SubmitButton className="justify-self-start">ذخیره</SubmitButton>
                </FieldGroup>
              </ServerForm>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">مهارت‌ها</CardTitle>
              <CardDescription>حداکثر {MAX_SKILLS.toLocaleString("fa-IR")} مهارت</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {p.skills.length === 0 ? <p className="text-sm text-muted-foreground">مهارتی ثبت نشده است.</p> : null}
                {p.skills.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1 pe-1">
                    {s.name}
                    <ActionButton action={removeSkillAction.bind(null, s.id)} size="icon-xs" variant="ghost">
                      <X />
                      <span className="sr-only">حذف {s.name}</span>
                    </ActionButton>
                  </Badge>
                ))}
              </div>
              <ServerForm action={addSkillAction} resetOnSuccess className="flex items-start gap-2">
                <div className="flex-1">
                  <Input name="name" placeholder="مثلاً: تعمیر پکیج" maxLength={80} aria-label="نام مهارت" />
                  <FormFieldError name="name" />
                </div>
                <SubmitButton variant="outline">
                  <Plus />
                  افزودن
                </SubmitButton>
              </ServerForm>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <ProfileChecklist
            status={p.verificationStatus}
            rejectionReason={p.rejectionReason}
            completeness={{ displayName: p.displayName, bio: p.bio, servicesCount: p.services.length, areasCount: p.areas.length, documentsCount: p.documents.length }}
          />
        </div>
      </div>
    </>
  );
}
