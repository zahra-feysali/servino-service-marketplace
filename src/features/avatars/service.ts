import { prisma } from "@/lib/prisma";
import { deleteStoredFiles, readStoredFile, saveFile } from "@/lib/storage";
import { readValidatedFile } from "@/lib/uploads";
import { lockRow } from "@/lib/db-locks";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES, canViewAvatar, type AvatarViewer } from "./rules";

/** Replaces the user's profile picture. The old file is removed only after the DB update succeeds. */
export async function setAvatar(userId: string, file: File) {
  const f = await readValidatedFile(file, AVATAR_MIME_TYPES, AVATAR_MAX_BYTES);
  const key = await saveFile(f.bytes, f.mime);
  let previous: string | null = null;
  try {
    // The user row is locked so concurrent uploads replace (and later delete) each other's files correctly.
    previous = await prisma.$transaction(async (tx) => {
      await lockRow(tx, "User", userId);
      const before = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarKey: true } });
      await tx.user.update({ where: { id: userId }, data: { avatarKey: key, avatarUpdatedAt: new Date() } });
      return before.avatarKey;
    });
  } catch (e) {
    await deleteStoredFiles([key]);
    throw e;
  }
  if (previous && previous !== key) await deleteStoredFiles([previous]);
}

export async function removeAvatar(userId: string) {
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarKey: true } });
  if (!before.avatarKey) return;
  await prisma.user.update({ where: { id: userId }, data: { avatarKey: null, avatarUpdatedAt: null } });
  await deleteStoredFiles([before.avatarKey]);
}

/** True when the two users are counterparts on a live (pending or accepted) offer. */
async function hasBusinessRelation(a: string, b: string): Promise<boolean> {
  const count = await prisma.providerOffer.count({
    where: {
      OR: [
        { provider: { userId: a }, request: { customerId: b }, status: { in: ["PENDING", "ACCEPTED"] } },
        { provider: { userId: b }, request: { customerId: a }, status: { in: ["PENDING", "ACCEPTED"] } },
      ],
    },
  });
  return count > 0;
}

/** Returns the picture for a viewer, or null when it does not exist or may not be seen. */
export async function getAvatarForViewer(viewer: AvatarViewer, targetId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, status: true, avatarKey: true, providerProfile: { select: { verificationStatus: true } } },
  });
  if (!target?.avatarKey) return null;
  const isPublicProvider =
    target.role === "PROVIDER" && target.status === "ACTIVE" && target.providerProfile?.verificationStatus === "APPROVED";
  const needsRelation = !isPublicProvider && !!viewer && viewer.id !== target.id && viewer.role !== "ADMIN";
  const related = needsRelation ? await hasBusinessRelation(viewer.id, target.id) : false;
  if (!canViewAvatar(viewer, { id: target.id, role: target.role, isPublicProvider }, related)) return null;
  const key = target.avatarKey;
  const mime = key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
  return { bytes: await readStoredFile(key), mime, isPublic: isPublicProvider };
}
