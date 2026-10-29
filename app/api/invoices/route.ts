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
    return NextResponse.json({ invoices: [] });
  }

  const [rows] = isAdmin
    ? await mysqlPool.query<RowDataPacket[]>(
        `SELECT i.invoice_id, i.client_id, c.company_name, i.billing_month, i.total_amount, i.payment_status
         FROM Invoices i JOIN Clients c ON c.client_id = i.client_id
         ORDER BY i.billing_month DESC`
      )
    : await mysqlPool.query<RowDataPacket[]>(
        `SELECT i.invoice_id, i.client_id, c.company_name, i.billing_month, i.total_amount, i.payment_status
         FROM Invoices i JOIN Clients c ON c.client_id = i.client_id
         WHERE i.client_id IN (?)
         ORDER BY i.billing_month DESC`,
        [clientIds]
      );

  return NextResponse.json({ invoices: rows });
}
