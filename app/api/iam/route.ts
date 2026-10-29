import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { auth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [employees] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT e.employee_id, e.first_name, e.last_name, e.email, e.created_at,
            cam.client_id, c.company_name, r.role_id, r.role_name
     FROM Employees e
     LEFT JOIN Client_Access_Mapping cam ON cam.employee_id = e.employee_id
     LEFT JOIN Clients c ON c.client_id = cam.client_id
     LEFT JOIN Roles r ON r.role_id = cam.role_id
     ORDER BY e.employee_id, c.company_name`
  );

  return NextResponse.json({ mappings: employees });
}

