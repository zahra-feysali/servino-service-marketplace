import type { DefaultSession } from "next-auth";
import type { AppRole } from "@/features/auth/rbac";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      /** Sign-in time (ms since epoch). */
      authTime: number;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    authTime?: number;
  }
}
