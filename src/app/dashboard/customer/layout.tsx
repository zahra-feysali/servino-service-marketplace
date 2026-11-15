import { DashboardShell } from "@/components/shared/dashboard/dashboard-shell";
import { requireRolePage } from "@/lib/authz";

export default async function CustomerDashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRolePage("CUSTOMER");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
