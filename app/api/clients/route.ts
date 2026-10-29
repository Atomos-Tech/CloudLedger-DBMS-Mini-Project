import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { auth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "Admin";
  const clientIds = session.user.clientIds ?? [];

  if (!isAdmin && clientIds.length === 0) {
    return NextResponse.json({ clients: [] });
  }

  const [rows] = isAdmin
    ? await mysqlPool.query<RowDataPacket[]>(
        `SELECT c.client_id, c.company_name, c.billing_address, c.account_status,
                COALESCE(v.running_total, 0) AS running_total
         FROM Clients c
         LEFT JOIN vw_client_current_bill v ON v.client_id = c.client_id
         ORDER BY c.company_name`
      )
    : await mysqlPool.query<RowDataPacket[]>(
        `SELECT c.client_id, c.company_name, c.billing_address, c.account_status,
                COALESCE(v.running_total, 0) AS running_total
         FROM Clients c
         LEFT JOIN vw_client_current_bill v ON v.client_id = c.client_id
         WHERE c.client_id IN (?)
         ORDER BY c.company_name`,
        [clientIds]
      );

  return NextResponse.json({ clients: rows });
}
