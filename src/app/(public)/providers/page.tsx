import type { Metadata } from "next";
import { connection } from "next/server";
import { Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getPublicCatalog, servicesOfCategory } from "@/features/catalog/queries";
import { ProviderCard } from "@/features/providers/components/provider-card";
import { listPublicProviders } from "@/features/providers/public-queries";
import { getActiveCitiesGrouped } from "@/features/requests/queries";
import { isUuid } from "@/lib/db-locks";
import { SLUG_REGEX } from "@/features/catalog/schemas";

export const metadata: Metadata = { title: "متخصصان" };

export default async function ProvidersPage({ searchParams }: PageProps<"/providers">) {
  await connection();
  const sp = await searchParams;
  const service = typeof sp.service === "string" && SLUG_REGEX.test(sp.service) ? sp.service : undefined;
  const city = isUuid(sp.city) ? sp.city : undefined;
  const [providers, catalog, provinces] = await Promise.all([
    listPublicProviders({ serviceSlug: service, cityId: city, placement: "SEARCH" }),
    getPublicCatalog(),
    getActiveCitiesGrouped(),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <PageHeader title="متخصصان سروینو" description="متخصصان تأییدشده را بر اساس خدمت و شهر پیدا کنید." />
      <form action="/providers" className="flex flex-col gap-2 sm:flex-row sm:items-end" role="search">
        <NativeSelect name="service" defaultValue={service ?? ""} className="w-full sm:w-64" aria-label="خدمت">
          <NativeSelectOption value="">همه خدمات</NativeSelectOption>
          {catalog.map((c) => (
            <NativeSelectOptGroup key={c.id} label={c.name}>
              {servicesOfCategory(c).map((s) => (
                <NativeSelectOption key={s.id} value={s.slug}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
        <NativeSelect name="city" defaultValue={city ?? ""} className="w-full sm:w-52" aria-label="شهر">
          <NativeSelectOption value="">همه شهرها</NativeSelectOption>
          {provinces.map((p) => (
            <NativeSelectOptGroup key={p.id} label={p.name}>
              {p.cities.map((c) => (
                <NativeSelectOption key={c.id} value={c.id}>
                  {c.name}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
          ))}
        </NativeSelect>
        <Button type="submit">
          <Search />
          جستجو
        </Button>
      </form>
      {providers.length === 0 ? (
        <EmptyState icon={Users} title="متخصصی با این مشخصات یافت نشد" description="فیلترها را تغییر دهید." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <ProviderCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}
