import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticate } from "@/features/auth/service";
import { loginSchema } from "@/features/auth/schemas";
import { isAppRole } from "@/features/auth/rbac";
import { clientIpFrom, namedLimiter } from "@/lib/rate-limit";

/** Error code returned to the client by Auth.js when login attempts are throttled. */
export const LOGIN_RATE_LIMITED = "RATE_LIMITED";

/**
 * Auth.js (NextAuth v4 stable line) configuration.
 * - Credentials provider only, passwords hashed with bcryptjs.
 * - JWT session strategy; no database adapter (users live in PostgreSQL via Prisma).
 * - The JWT only carries identity + role for routing. Authorization decisions
 *   re-load the user from the database (src/lib/authz.ts).
 */
export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        identifier: { label: "موبایل یا ایمیل", type: "text" },
        password: { label: "رمز عبور", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Brute-force protection: only FAILED attempts count, per account identifier and per client IP.
        const idKey = `login:id:${parsed.data.identifier.trim().toLowerCase()}`;
        const ipKey = `login:ip:${clientIpFrom(req?.headers)}`;
        const byId = namedLimiter("login-id", 10, 15 * 60 * 1000);
        const byIp = namedLimiter("login-ip", 50, 15 * 60 * 1000);
        if (byId.isBlocked(idKey) || byIp.isBlocked(ipKey)) throw new Error(LOGIN_RATE_LIMITED);

        const user = await authenticate(parsed.data.identifier, parsed.data.password);
        if (!user) {
          byId.hit(idKey);
          byIp.hit(ipKey);
          return null;
        }
        byId.reset(idKey);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
        // Sign-in time (ms). Sessions older than the last password change are rejected in authz.
        token.authTime = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub && isAppRole(token.role)) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.authTime = typeof token.authTime === "number" ? token.authTime : 0;
      }
      return session;
    },
  },
};
