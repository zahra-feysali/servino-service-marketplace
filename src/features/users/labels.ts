import type { UserStatus } from "@/generated/prisma/enums";

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "فعال",
  INACTIVE: "غیرفعال",
  SUSPENDED: "مسدود",
};
