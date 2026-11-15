import type { Metadata } from "next";
import { PaginationNav } from "@/components/shared/pagination-nav";
import { parsePage } from "@/lib/pagination";
import { FilterLinks, pickParam } from "@/components/shared/filter-links";
import { PageHeader } from "@/components/shared/page-header";
import { adminListUsers } from "@/features/users/admin-service";
import { UserSearch, UsersTable } from "@/features/users/components/users-table";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "مشتریان" };
const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

export default async function AdminCustomersPage({ searchParams }: PageProps<"/dashboard/admin/customers">) {
  await requireRolePage("ADMIN");
  const sp = await searchParams;
  const status = pickParam(sp.status, STATUSES);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const users = await adminListUsers({ role: "CUSTOMER", status, q }, parsePage(sp.page));

  return (
    <>
      <PageHeader title="مشتریان" description="مشاهده، ویرایش و مدیریت وضعیت حساب مشتریان" />
      <UserSearch basePath="/dashboard/admin/customers" q={q} hidden={{ status }} />
      <FilterLinks
        basePath="/dashboard/admin/customers"
        param="status"
        current={status}
        extra={{ q }}
        options={[
          { value: "", label: "همه" },
          { value: "ACTIVE", label: "فعال" },
          { value: "INACTIVE", label: "غیرفعال" },
          { value: "SUSPENDED", label: "مسدود" },
        ]}
      />
      <UsersTable users={users.items} kind="customer" />
      <PaginationNav basePath="/dashboard/admin/customers" params={sp} page={users.page} totalPages={users.totalPages} total={users.total} />
    </>
  );
}
