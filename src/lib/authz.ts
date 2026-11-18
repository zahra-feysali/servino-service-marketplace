import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError, ForbiddenError } from "@/lib/errors";
import { dashboardPathForRole, hasRole, type AppRole } from "@/features/auth/rbac";
import { avatarSrc } from "@/features/avatars/rules";

/**
 * Server-side authentication & authorization guards.
 *
 * The JWT is only trusted for the user id. The user's role and status are always
 * re-read from PostgreSQL so suspensions/role changes take effect immediately.
 */

export type CurrentUser = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: AppRole;
  /** Versioned profile-picture URL, or null for the default avatar. */
  avatarUrl: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, phone: true, email: true, role: true, status: true, passwordChangedAt: true, avatarUpdatedAt: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  // Sessions issued before the latest password change are no longer valid.
  if (user.passwordChangedAt && user.passwordChangedAt.getTime() > (session.user.authTime ?? 0)) return null;

  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    avatarUrl: avatarSrc(user.id, user.avatarUpdatedAt),
  };
});

// ── Page guards (redirect) ───────────────────────────────────────────────────

export async function requireUserPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRolePage(...roles: AppRole[]): Promise<CurrentUser> {
  const user = await requireUserPage();
  if (!hasRole(user.role, roles)) redirect(dashboardPathForRole(user.role));
  return user;
}

// ── Action / route-handler guards (throw AppError subclasses) ───────────────

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError();
  return user;
}

export async function requireRole(...roles: AppRole[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!hasRole(user.role, roles)) throw new ForbiddenError();
  return user;
}

/** Ownership check: the resource must belong to the user (admins pass only when `allowAdmin`). */
export function assertOwnership(
  user: Pick<CurrentUser, "id" | "role">,
  ownerId: string,
  options: { allowAdmin?: boolean } = {},
): void {
  if (user.id === ownerId) return;
  if (options.allowAdmin && user.role === "ADMIN") return;
  throw new ForbiddenError();
}
