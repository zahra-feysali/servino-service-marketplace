import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticate } from "@/features/auth/service";
import { loginSchema } from "@/features/auth/schemas";
import { isAppRole } from "@/features/auth/rbac";

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
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await authenticate(parsed.data.identifier, parsed.data.password);
        if (!user) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub && isAppRole(token.role)) {
        session.user.id = token.sub;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
