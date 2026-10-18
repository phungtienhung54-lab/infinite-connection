import { DefaultSession } from "next-auth";
import type { AccountType, UserRole, VerificationStatus } from "@prisma/client";

declare module "next-auth" {
  interface User {
    accountType: AccountType;
    role: UserRole;
    organizationName?: string;
    organizationStatus?: VerificationStatus;
  }

  interface Session {
    user: {
      id: string;
      accountType: AccountType;
      role: UserRole;
      organizationName?: string;
      organizationStatus?: VerificationStatus;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    accountType?: AccountType;
    role?: UserRole;
    organizationName?: string;
    organizationStatus?: VerificationStatus;
  }
}
