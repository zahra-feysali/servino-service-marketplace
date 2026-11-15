import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { VERIFICATION_STATUS_META } from "@/features/providers/labels";
import type { adminListUsers } from "@/features/users/admin-service";
import { USER_STATUS_LABELS } from "@/features/users/labels";
import { formatDate, toPersianDigits } from "@/lib/utils";

type Users = Awaited<ReturnType<typeof adminListUsers>>["items"];

export function UserSearch({ basePath, q, hidden }: { basePath: string; q?: string; hidden?: Record<string, string | undefined> }) {
  return (
    <form action={basePath} className="flex max-w-md gap-2" role="search">
      {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Input name="q" defaultValue={q} placeholder="جستجو: نام، موبایل یا ایمیل" aria-label="جستجو" />
      <Button type="submit" variant="outline">
        <Search />
        جستجو
      </Button>
    </form>
  );
}

export function UsersTable({ users, kind }: { users: Users; kind: "customer" | "provider" }) {
  if (users.length === 0) return <EmptyState icon={Users} title="کاربری یافت نشد" />;
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-start">نام</TableHead>
            <TableHead className="text-start">موبایل</TableHead>
            <TableHead className="text-start">وضعیت حساب</TableHead>
            {kind === "provider" ? <TableHead className="text-start">تأیید</TableHead> : <TableHead className="text-start">درخواست / سفارش</TableHead>}
            <TableHead className="text-start">عضویت</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">
                {u.fullName}
                {u.providerProfile ? <span className="block text-xs text-muted-foreground">{u.providerProfile.displayName}</span> : null}
              </TableCell>
              <TableCell className="ltr-nums">{u.phone}</TableCell>
              <TableCell>
                <Badge variant={u.status === "ACTIVE" ? "secondary" : "destructive"}>{USER_STATUS_LABELS[u.status]}</Badge>
              </TableCell>
              {kind === "provider" ? (
                <TableCell>
                  {u.providerProfile ? (
                    <Badge variant={VERIFICATION_STATUS_META[u.providerProfile.verificationStatus].variant}>
                      {VERIFICATION_STATUS_META[u.providerProfile.verificationStatus].label}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
              ) : (
                <TableCell>
                  {toPersianDigits(u._count.requests)} / {toPersianDigits(u._count.customerOrders)}
                </TableCell>
              )}
              <TableCell>{formatDate(u.createdAt)}</TableCell>
              <TableCell className="flex gap-1">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/admin/users/${u.id}`}>حساب</Link>
                </Button>
                {u.providerProfile ? (
                  <Button asChild size="sm">
                    <Link href={`/dashboard/admin/providers/${u.providerProfile.id}`}>پروفایل حرفه‌ای</Link>
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
