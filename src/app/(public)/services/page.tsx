import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ServiceIcon } from "@/components/shared/service-icon";
import { getPublicCatalog } from "@/features/catalog/queries";

export const metadata: Metadata = { title: "خدمات" };

type ServiceItem = { id: string; name: string; slug: string; shortDescription: string | null; icon: string | null };

function ServiceGrid({ services }: { services: ServiceItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <Link key={service.id} href={`/services/${service.slug}`} className="group">
          <Card className="h-full transition-shadow group-hover:shadow-md">
            <CardContent className="flex items-start gap-3">
              <ServiceIcon name={service.icon} className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0 space-y-1">
                <h4 className="font-medium group-hover:text-primary">{service.name}</h4>
                {service.shortDescription ? (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{service.shortDescription}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default async function ServicesPage() {
  await connection();
  const catalog = await getPublicCatalog();

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <PageHeader title="همه خدمات" description="دسته‌بندی‌ها و خدماتی که متخصصان سروینو ارائه می‌دهند." />

      {catalog.length === 0 ? (
        <EmptyState title="هنوز خدمتی ثبت نشده است" />
      ) : (
        catalog.map((category) => (
          <section key={category.id} id={category.slug} className="scroll-mt-24 space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <ServiceIcon name={category.icon} className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold">{category.name}</h2>
                {category.description ? <p className="text-sm text-muted-foreground">{category.description}</p> : null}
              </div>
            </div>

            {category.services.length > 0 ? <ServiceGrid services={category.services} /> : null}

            {category.children.map((sub) =>
              sub.services.length > 0 ? (
                <div key={sub.id} className="space-y-3 border-s-2 border-secondary ps-4">
                  <h3 className="font-semibold text-muted-foreground">{sub.name}</h3>
                  <ServiceGrid services={sub.services} />
                </div>
              ) : null,
            )}

            {category.services.length === 0 && category.children.every((c) => c.services.length === 0) ? (
              <p className="text-sm text-muted-foreground">در این دسته‌بندی هنوز خدمتی فعال نشده است.</p>
            ) : null}
          </section>
        ))
      )}
    </div>
  );
}
