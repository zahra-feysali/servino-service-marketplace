import Link from "next/link";
import { BadgeCheck, MapPin, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toPersianDigits } from "@/lib/utils";

export type PublicProviderCard = {
  id: string;
  displayName: string;
  bio: string | null;
  yearsOfExperience: number;
  ratingAverage: number;
  ratingCount: number;
  completedOrdersCount: number;
  services: { service: { name: string } }[];
  areas: { city: { name: string } }[];
  isFeatured?: boolean;
};

export function ProviderCard({ p }: { p: PublicProviderCard }) {
  return (
    <Link href={`/providers/${p.id}`} className="group">
      <Card className={`h-full transition-shadow group-hover:shadow-md ${p.isFeatured ? "border-warning/60" : ""}`}>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-lg font-bold text-primary">{p.displayName.slice(0, 1)}</span>
              <div>
                <h3 className="flex items-center gap-1 font-semibold group-hover:text-primary">
                  {p.displayName}
                  <BadgeCheck className="size-4 text-primary" aria-label="تأییدشده" />
                </h3>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="size-3.5 fill-warning text-warning" aria-hidden />
                  {p.ratingCount > 0
                    ? `${p.ratingAverage.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} (${toPersianDigits(p.ratingCount)} نظر)`
                    : "بدون نظر"}{" "}
                  · {toPersianDigits(p.completedOrdersCount)} سفارش
                </p>
              </div>
            </div>
            {p.isFeatured ? (
              <Badge variant="secondary" className="bg-warning/15 text-accent-foreground">
                <Sparkles />
                ویژه
              </Badge>
            ) : null}
          </div>
          {p.bio ? <p className="line-clamp-2 text-sm text-muted-foreground">{p.bio}</p> : null}
          <div className="flex flex-wrap gap-1">
            {p.services.map((s) => (
              <Badge key={s.service.name} variant="outline">
                {s.service.name}
              </Badge>
            ))}
          </div>
          {p.areas.length ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {p.areas.map((a) => a.city.name).join("، ")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
