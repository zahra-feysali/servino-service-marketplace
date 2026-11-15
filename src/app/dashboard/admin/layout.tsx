import { DashboardShell } from "@/components/shared/dashboard/dashboard-shell";
import { requireRolePage } from "@/lib/authz";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRolePage("ADMIN");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
