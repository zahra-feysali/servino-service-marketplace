import { connection } from "next/server";
import { getCurrentUser, type CurrentUser } from "@/lib/authz";

/**
 * Like getCurrentUser, but returns null instead of throwing when the database is unreachable.
 * `connection()` runs first (outside the try) so the route is explicitly request-time rendered
 * and Next's internal dynamic-rendering signal is never swallowed by the catch below.
 */
export async function getCurrentUserSafe(): Promise<CurrentUser | null> {
  await connection();
  try {
    return await getCurrentUser();
  } catch (error) {
    console.error("[auth] could not load current user", error);
    return null;
  }
}
