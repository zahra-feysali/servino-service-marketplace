import { redirect } from "next/navigation";
import { requireUserPage } from "@/lib/authz";
import { dashboardPathForRole } from "@/features/auth/rbac";

/** Entry point: sends each user to their own role's dashboard (role read from the database). */
export default async function DashboardIndexPage() {
  const user = await requireUserPage();
  redirect(dashboardPathForRole(user.role));
}
