import type { Metadata } from "next";
import { Eye, EyeOff, MapPinned, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { FormFieldError, ServerForm, SubmitButton } from "@/components/shared/server-form";
import {
  deleteCityAction,
  deleteProvinceAction,
  saveCityAction,
  saveProvinceAction,
  setCityActiveAction,
  setProvinceActiveAction,
} from "@/features/locations/actions";
import { listAllCitiesGrouped } from "@/features/locations/queries";
import { requireRolePage } from "@/lib/authz";
import { toPersianDigits } from "@/lib/utils";

export const metadata: Metadata = { title: "مدیریت شهرها" };

type Province = Awaited<ReturnType<typeof listAllCitiesGrouped>>[number];

function NameFields({ k, v }: { k: string; v?: { name: string; slug: string; sortOrder: number } }) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`name-${k}`}>نام</FieldLabel>
        <Input id={`name-${k}`} name="name" required maxLength={80} defaultValue={v?.name} />
        <FormFieldError name="name" />
      </Field>
      <Field>
        <FieldLabel htmlFor={`slug-${k}`}>نامک</FieldLabel>
        <Input id={`slug-${k}`} name="slug" required dir="ltr" className="text-end" placeholder="tehran" defaultValue={v?.slug} />
        <FormFieldError name="slug" />
      </Field>
      <Field>
        <FieldLabel htmlFor={`sort-${k}`}>ترتیب</FieldLabel>
        <Input id={`sort-${k}`} name="sortOrder" type="number" min={0} max={9999} dir="ltr" defaultValue={v?.sortOrder ?? 0} />
      </Field>
    </>
  );
}

function ProvinceSelect({ k, provinces, value }: { k: string; provinces: Province[]; value?: string }) {
  return (
    <Field>
      <FieldLabel htmlFor={`province-${k}`}>استان</FieldLabel>
      <NativeSelect id={`province-${k}`} name="provinceId" className="w-full" defaultValue={value ?? ""} required>
        <NativeSelectOption value="" disabled>
          انتخاب استان
        </NativeSelectOption>
        {provinces.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <FormFieldError name="provinceId" />
    </Field>
  );
}

export default async function AdminCitiesPage() {
  await requireRolePage("ADMIN");
  const provinces = await listAllCitiesGrouped();
  const cityCount = provinces.reduce((n, p) => n + p.cities.length, 0);

  return (
    <>
      <PageHeader
        icon={MapPinned}
        title="مدیریت شهرها"
        description={`${toPersianDigits(provinces.length)} استان و ${toPersianDigits(cityCount)} شهر. غیرفعال‌کردن، شهر را از فرم‌ها و فیلترها پنهان می‌کند ولی هیچ اطلاعاتی را حذف نمی‌کند؛ حذف فقط برای موارد بدون سابقه ممکن است.`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">افزودن استان</CardTitle>
          </CardHeader>
          <CardContent>
            <ServerForm action={saveProvinceAction.bind(null, null)} resetOnSuccess>
              <FieldGroup>
                <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
                  <NameFields k="new-province" />
                </div>
                <SubmitButton className="justify-self-start">افزودن استان</SubmitButton>
              </FieldGroup>
            </ServerForm>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">افزودن شهر</CardTitle>
          </CardHeader>
          <CardContent>
            <ServerForm action={saveCityAction.bind(null, null)} resetOnSuccess>
              <FieldGroup>
                <ProvinceSelect k="new-city" provinces={provinces} />
                <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
                  <NameFields k="new-city" />
                </div>
                <SubmitButton className="justify-self-start">افزودن شهر</SubmitButton>
              </FieldGroup>
            </ServerForm>
          </CardContent>
        </Card>
      </div>

      {provinces.length === 0 ? (
        <EmptyState icon={MapPinned} title="هنوز استانی ثبت نشده است" />
      ) : (
        <div className="space-y-4">
          {provinces.map((p) => (
            <Card key={p.id} className={p.isActive ? undefined : "opacity-80"}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {p.name}
                    <Badge variant={p.isActive ? "default" : "outline"}>{p.isActive ? "فعال" : "غیرفعال"}</Badge>
                  </CardTitle>
                  <CardDescription dir="ltr" className="text-end sm:text-start">
                    {p.slug}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-1">
                  <ActionButton action={setProvinceActiveAction.bind(null, p.id, !p.isActive)} size="sm" variant="ghost">
                    {p.isActive ? <EyeOff /> : <Eye />}
                    {p.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                  </ActionButton>
                  <ActionButton
                    action={deleteProvinceAction.bind(null, p.id)}
                    size="sm"
                    variant="ghost"
                    confirm={{ title: `حذف استان «${p.name}»؟`, description: "فقط استان بدون شهر قابل حذف است.", confirmLabel: "حذف", destructive: true }}
                  >
                    <Trash2 />
                    حذف
                  </ActionButton>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <details className="group rounded-xl border bg-muted/20 px-4 py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-sm font-medium">
                    <Pencil className="size-4 text-muted-foreground" aria-hidden />
                    ویرایش استان
                  </summary>
                  <ServerForm action={saveProvinceAction.bind(null, p.id)} className="pt-3 pb-2">
                    <FieldGroup>
                      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
                        <NameFields k={p.id} v={p} />
                      </div>
                      <SubmitButton size="sm" variant="outline" className="justify-self-start">
                        ذخیره
                      </SubmitButton>
                    </FieldGroup>
                  </ServerForm>
                </details>

                {p.cities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">شهری برای این استان ثبت نشده است.</p>
                ) : (
                  <ul className="divide-y rounded-xl border">
                    {p.cities.map((c) => {
                      const used = c._count.requests + c._count.addresses + c._count.serviceAreas;
                      return (
                        <li key={c.id} className="space-y-2 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="font-medium">{c.name}</span>
                              <Badge variant={c.isActive ? "secondary" : "outline"}>{c.isActive ? "فعال" : "غیرفعال"}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {toPersianDigits(c._count.requests)} درخواست · {toPersianDigits(c._count.addresses)} نشانی · {toPersianDigits(c._count.serviceAreas)} متخصص
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              <ActionButton action={setCityActiveAction.bind(null, c.id, !c.isActive)} size="sm" variant="ghost">
                                {c.isActive ? <EyeOff /> : <Eye />}
                                {c.isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}
                              </ActionButton>
                              {used === 0 ? (
                                <ActionButton
                                  action={deleteCityAction.bind(null, c.id)}
                                  size="sm"
                                  variant="ghost"
                                  confirm={{ title: `حذف شهر «${c.name}»؟`, description: "این شهر هیچ سابقه‌ای ندارد و برای همیشه حذف می‌شود.", confirmLabel: "حذف", destructive: true }}
                                >
                                  <Trash2 />
                                  حذف
                                </ActionButton>
                              ) : null}
                            </div>
                          </div>
                          <details className="text-sm">
                            <summary className="w-fit cursor-pointer text-xs text-primary">ویرایش شهر</summary>
                            <ServerForm action={saveCityAction.bind(null, c.id)} className="pt-3">
                              <FieldGroup>
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_6rem]">
                                  <ProvinceSelect k={c.id} provinces={provinces} value={p.id} />
                                  <NameFields k={c.id} v={c} />
                                </div>
                                <SubmitButton size="sm" variant="outline" className="justify-self-start">
                                  ذخیره
                                </SubmitButton>
                              </FieldGroup>
                            </ServerForm>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
