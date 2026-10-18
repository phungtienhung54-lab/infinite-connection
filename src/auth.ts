import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { AccountType, UserRole, VerificationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "邮箱", type: "email" },
        password: { label: "密码", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email },
          include: { organization: true },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        const adminEmails = (process.env.ADMIN_EMAILS ?? "")
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          accountType: user.accountType,
          role: adminEmails.includes(user.email) ? "ADMIN" : user.role,
          organizationName: user.organization?.name,
          organizationStatus: user.organization?.verificationStatus,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.accountType = user.accountType;
        token.role = user.role;
        token.organizationName = user.organizationName;
        token.organizationStatus = user.organizationStatus;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = String(token.id);
        session.user.accountType = (token.accountType as AccountType | undefined) ?? "PERSONAL";
        session.user.role = (token.role as UserRole | undefined) ?? "USER";
        session.user.organizationName = token.organizationName as string | undefined;
        session.user.organizationStatus = token.organizationStatus as VerificationStatus | undefined;
      }
      return session;
    },
  },
});
