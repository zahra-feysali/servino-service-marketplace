import { prisma, type TxClient } from "@/lib/prisma";
import { AppError, NotFoundError } from "@/lib/errors";

/** Loads the provider profile of a user (by user id from the session). */
export async function getProviderProfileByUserId(userId: string, db: TxClient | typeof prisma = prisma) {
  const profile = await db.providerProfile.findUnique({
    where: { userId },
    select: { id: true, userId: true, displayName: true, verificationStatus: true },
  });
  if (!profile) throw new NotFoundError("پروفایل متخصص یافت نشد.");
  return profile;
}

/** Only APPROVED providers may take part in the request/offer process. */
export async function requireApprovedProvider(userId: string, db: TxClient | typeof prisma = prisma) {
  const profile = await getProviderProfileByUserId(userId, db);
  if (profile.verificationStatus !== "APPROVED") {
    throw new AppError("حساب حرفه‌ای شما هنوز تأیید نشده است.", "PROVIDER_NOT_APPROVED");
  }
  return profile;
}
