import { DashboardShell } from "@/components/shared/dashboard/dashboard-shell";
import { requireRolePage } from "@/lib/authz";

export default async function ProviderDashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRolePage("PROVIDER");
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
