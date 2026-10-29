import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    clientIds: number[];
  }

  interface Session {
    user: {
      role: string;
      clientIds: number[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    clientIds: number[];
  }
}
