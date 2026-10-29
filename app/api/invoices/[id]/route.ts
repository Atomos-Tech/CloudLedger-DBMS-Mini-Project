import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { auth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import { updateInvoiceStatusSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "Admin" && role !== "Billing") {
    return NextResponse.json(
      { error: "Only Admin or Billing roles can update invoice status." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateInvoiceStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const isAdmin = role === "Admin";
  const clientIds = session.user.clientIds ?? [];

  const [rows] = await mysqlPool.query<RowDataPacket[]>(
    "SELECT client_id FROM Invoices WHERE invoice_id = ? LIMIT 1",
    [invoiceId]
  );
  const invoice = rows[0];
  if (!invoice) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isAdmin && !clientIds.includes(invoice.client_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await mysqlPool.query(
    "UPDATE Invoices SET payment_status = ? WHERE invoice_id = ?",
    [parsed.data.payment_status, invoiceId]
  );

  return NextResponse.json({ ok: true });
}

