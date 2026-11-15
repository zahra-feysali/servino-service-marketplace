import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ServerForm, SubmitButton } from "@/components/shared/server-form";
import { getPublicCatalog, servicesOfCategory } from "@/features/catalog/queries";
import { setProviderAreasAction, setProviderServicesAction } from "@/features/providers/actions";
import { getProviderWorkspace } from "@/features/providers/profile-service";
import { getActiveCitiesGrouped } from "@/features/requests/queries";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "خدمات و مناطق" };

function CheckItem({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-secondary/60">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}

export default async function ProviderServicesPage() {
  const user = await requireRolePage("PROVIDER");
  const [p, catalog, provinces] = await Promise.all([getProviderWorkspace(user.id), getPublicCatalog(), getActiveCitiesGrouped()]);
  const selectedServices = new Set(p.services.map((s) => s.serviceId));
  const selectedCities = new Set(p.areas.map((a) => a.cityId));

  return (
    <>
      <PageHeader
        title="خدمات و مناطق خدمت‌رسانی"
        description="درخواست‌ها فقط بر اساس خدماتی که انتخاب می‌کنید و شهرهایی که در آن‌ها کار می‌کنید برای شما ارسال می‌شوند."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">خدماتی که ارائه می‌دهم</CardTitle>
        </CardHeader>
        <CardContent>
          <ServerForm action={setProviderServicesAction} className="space-y-5">
            {catalog.map((c) => {
              const services = servicesOfCategory(c);
              if (services.length === 0) return null;
              return (
                <fieldset key={c.id} className="space-y-2">
                  <legend className="mb-2 text-sm font-semibold">{c.name}</legend>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {services.map((s) => (
                      <CheckItem key={s.id} name="serviceIds" value={s.id} label={s.name} checked={selectedServices.has(s.id)} />
                    ))}
                  </div>
                </fieldset>
              );
            })}
            <SubmitButton>ذخیره خدمات</SubmitButton>
          </ServerForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">شهرهای محل فعالیت</CardTitle>
          <CardDescription>درخواست‌های ثبت‌شده در این شهرها برای شما ارسال می‌شود.</CardDescription>
        </CardHeader>
        <CardContent>
          <ServerForm action={setProviderAreasAction} className="space-y-5">
            {provinces.map((pr) => (
              <fieldset key={pr.id} className="space-y-2">
                <legend className="mb-2 text-sm font-semibold">{pr.name}</legend>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {pr.cities.map((c) => (
                    <CheckItem key={c.id} name="cityIds" value={c.id} label={c.name} checked={selectedCities.has(c.id)} />
                  ))}
                </div>
              </fieldset>
            ))}
            <SubmitButton>ذخیره مناطق</SubmitButton>
          </ServerForm>
        </CardContent>
      </Card>
    </>
  );
}
