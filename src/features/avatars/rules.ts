import type { UploadableMime } from "@/features/forms/definitions";

/** Profile pictures: small square images (the client crops/resizes to 512 px before upload). */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES: UploadableMime[] = ["image/jpeg", "image/png", "image/webp"];

/** URL of a user's picture, or null when the user has none (the UI then shows the default avatar). */
export function avatarSrc(userId: string, avatarUpdatedAt: Date | string | null | undefined): string | null {
  if (!avatarUpdatedAt) return null;
  const v = new Date(avatarUpdatedAt).getTime();
  return Number.isFinite(v) ? `/api/avatars/${userId}?v=${v}` : null;
}

type Role = "CUSTOMER" | "PROVIDER" | "ADMIN";
export type AvatarViewer = { id: string; role: Role } | null;
export type AvatarTarget = { id: string; role: Role; isPublicProvider: boolean };

/**
 * Who may see a profile picture:
 * - approved + active providers: everyone (public profile pages and listings);
 * - the user themself and admins: always;
 * - otherwise only a counterpart with a business relation (offer → order → chat).
 * Customer pictures are never public (public reviews show the default avatar).
 */
export function canViewAvatar(viewer: AvatarViewer, target: AvatarTarget, hasRelation: boolean): boolean {
  if (target.role === "PROVIDER" && target.isPublicProvider) return true;
  if (!viewer) return false;
  if (viewer.id === target.id || viewer.role === "ADMIN") return true;
  return hasRelation;
}

/** Up to two initials for the default avatar. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 1);
  return `${parts[0].slice(0, 1)}‌${parts[parts.length - 1].slice(0, 1)}`;
}
