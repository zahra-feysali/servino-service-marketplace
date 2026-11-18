import type { Metadata } from "next";
import { MapPin, Wrench } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ServerForm, SubmitButton } from "@/components/shared/server-form";
import { StatCard } from "@/components/shared/stat-card";
import { getPublicCatalog, servicesOfCategory } from "@/features/catalog/queries";
import { setProviderAreasAction, setProviderServicesAction } from "@/features/providers/actions";
import { SelectionGroups } from "@/features/providers/components/selection-groups";
import { getProviderWorkspace } from "@/features/providers/profile-service";
import { MAX_PROVIDER_SERVICES, MAX_SERVICE_AREAS } from "@/features/providers/verification";
import { getActiveCitiesGrouped } from "@/features/requests/queries";
import { requireRolePage } from "@/lib/authz";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "خدمات و مناطق" };

export default async function ProviderServicesPage() {
  const user = await requireRolePage("PROVIDER");
  const [p, catalog, provinces] = await Promise.all([getProviderWorkspace(user.id), getPublicCatalog(), getActiveCitiesGrouped()]);

  const serviceGroups = catalog
    .map((c) => ({ id: c.id, title: c.name, items: servicesOfCategory(c).map((s) => ({ id: s.id, label: s.name })) }))
    .filter((g) => g.items.length > 0);
  const cityGroups = provinces.map((pr) => ({ id: pr.id, title: pr.name, items: pr.cities.map((c) => ({ id: c.id, label: c.name })) }));
  const activeServiceIds = new Set(serviceGroups.flatMap((g) => g.items.map((i) => i.id)));
  const activeCityIds = new Set(cityGroups.flatMap((g) => g.items.map((i) => i.id)));
  const selectedServices = p.services.map((s) => s.serviceId).filter((id) => activeServiceIds.has(id));
  const selectedCities = p.areas.map((a) => a.cityId).filter((id) => activeCityIds.has(id));

  return (
    <>
      <PageHeader
        icon={Wrench}
        title="خدمات و مناطق خدمت‌رسانی"
        description="درخواست‌ها فقط بر اساس خدماتی که انتخاب می‌کنید و شهرهایی که در آن‌ها کار می‌کنید برای شما ارسال می‌شوند."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="خدمات فعال من" value={formatNumber(selectedServices.length)} icon={Wrench} tone="primary" hint="از میان خدمات فعال سایت" />
        <StatCard label="شهرهای محل فعالیت" value={formatNumber(selectedCities.length)} icon={MapPin} tone="green" hint="درخواست‌های این شهرها را دریافت می‌کنید" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="size-4 text-primary" aria-hidden />
            خدماتی که ارائه می‌دهم
          </CardTitle>
          <CardDescription>خدمات هر دسته را انتخاب کنید؛ می‌توانید همه خدمات یک دسته را یک‌جا انتخاب کنید.</CardDescription>
        </CardHeader>
        <CardContent>
          <ServerForm action={setProviderServicesAction} className="space-y-6">
            <SelectionGroups name="serviceIds" groups={serviceGroups} selected={selectedServices} max={MAX_PROVIDER_SERVICES} unit="خدمت" searchPlaceholder="جستجوی خدمت…" />
            <div className="flex justify-end border-t pt-4">
              <SubmitButton>ذخیره خدمات</SubmitButton>
            </div>
          </ServerForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="size-4 text-primary" aria-hidden />
            شهرهای محل فعالیت
          </CardTitle>
          <CardDescription>درخواست‌های ثبت‌شده در این شهرها برای شما ارسال می‌شود.</CardDescription>
        </CardHeader>
        <CardContent>
          <ServerForm action={setProviderAreasAction} className="space-y-6">
            <SelectionGroups name="cityIds" groups={cityGroups} selected={selectedCities} max={MAX_SERVICE_AREAS} unit="شهر" searchPlaceholder="جستجوی شهر…" />
            <div className="flex justify-end border-t pt-4">
              <SubmitButton>ذخیره مناطق</SubmitButton>
            </div>
          </ServerForm>
        </CardContent>
      </Card>
    </>
  );
}
