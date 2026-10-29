import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { mysqlPool } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";

interface EmployeeRow extends RowDataPacket {
  employee_id: number;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
}

interface AccessRow extends RowDataPacket {
  client_id: number;
  role_name: string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [rows] = await mysqlPool.query<EmployeeRow[]>(
          "SELECT employee_id, first_name, last_name, email, password_hash FROM Employees WHERE email = ? LIMIT 1",
          [email]
        );
        const employee = rows[0];
        if (!employee) return null;

        const valid = await bcrypt.compare(password, employee.password_hash);
        if (!valid) return null;

        const [access] = await mysqlPool.query<AccessRow[]>(
          `SELECT cam.client_id, r.role_name
           FROM Client_Access_Mapping cam
           JOIN Roles r ON r.role_id = cam.role_id
           WHERE cam.employee_id = ?`,
          [employee.employee_id]
        );

        const isAdmin = access.some((a) => a.role_name === "Admin");
        const clientIds = [...new Set(access.map((a) => a.client_id))];

        return {
          id: String(employee.employee_id),
          name: `${employee.first_name} ${employee.last_name}`,
          email: employee.email,
          role: isAdmin ? "Admin" : (access[0]?.role_name ?? "DevOps"),
          clientIds,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
        token.clientIds = user.clientIds;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.clientIds = token.clientIds as number[];
      }
      return session;
    },
  },
});
