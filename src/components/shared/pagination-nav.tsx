import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHref } from "@/lib/pagination";
import { toPersianDigits } from "@/lib/utils";

/** Server-rendered pager (RTL: "previous" points right). Hidden when there is a single page. */
export function PaginationNav({
  basePath,
  params,
  page,
  totalPages,
  total,
}: {
  basePath: string;
  params: Record<string, string | string[] | undefined>;
  page: number;
  totalPages: number;
  total: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-between gap-2 text-sm" aria-label="صفحه‌بندی">
      <span className="text-muted-foreground">
        صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)} — {toPersianDigits(total)} مورد
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button asChild size="sm" variant="outline">
            <Link href={pageHref(basePath, params, page - 1)} rel="prev">
              <ChevronRight />
              قبلی
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            <ChevronRight />
            قبلی
          </Button>
        )}
        {page < totalPages ? (
          <Button asChild size="sm" variant="outline">
            <Link href={pageHref(basePath, params, page + 1)} rel="next">
              بعدی
              <ChevronLeft />
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            بعدی
            <ChevronLeft />
          </Button>
        )}
      </div>
    </nav>
  );
}
