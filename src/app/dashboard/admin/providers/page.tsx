import type { Metadata } from "next";
import { FilterLinks, pickParam } from "@/components/shared/filter-links";
import { PageHeader } from "@/components/shared/page-header";
import { adminListUsers } from "@/features/users/admin-service";
import { UserSearch, UsersTable } from "@/features/users/components/users-table";
import { requireRolePage } from "@/lib/authz";

export const metadata: Metadata = { title: "متخصصان" };
const VERIFICATIONS = ["DRAFT", "PENDING", "APPROVED", "REJECTED"] as const;

export default async function AdminProvidersPage({ searchParams }: PageProps<"/dashboard/admin/providers">) {
  await requireRolePage("ADMIN");
  const sp = await searchParams;
  const verification = pickParam(sp.verification, VERIFICATIONS);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : undefined;
  const users = await adminListUsers({ role: "PROVIDER", verification, q });

  return (
    <>
      <PageHeader title="متخصصان و تأیید پروفایل" description="بررسی مدارک، تأیید یا رد متخصصان و مدیریت حساب‌ها" />
      <UserSearch basePath="/dashboard/admin/providers" q={q} hidden={{ verification }} />
      <FilterLinks
        basePath="/dashboard/admin/providers"
        param="verification"
        current={verification}
        extra={{ q }}
        options={[
          { value: "", label: "همه" },
          { value: "PENDING", label: "در انتظار تأیید" },
          { value: "APPROVED", label: "تأییدشده" },
          { value: "REJECTED", label: "ردشده" },
          { value: "DRAFT", label: "پروفایل ناقص" },
        ]}
      />
      <UsersTable users={users} kind="provider" />
    </>
  );
}
