import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import { generateInvoiceSchema } from "@/lib/validation";

// Admin or Billing (scoped): (re)generate a client's monthly invoice via sp_generate_monthly_invoice.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "Admin" && role !== "Billing") {
    return NextResponse.json(
      { error: "Only Admin or Billing roles can generate invoices." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = generateInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { client_id, billing_month } = parsed.data;
  const isAdmin = role === "Admin";
  const clientIds = session.user.clientIds ?? [];

  if (!isAdmin && !clientIds.includes(client_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await mysqlPool.query("CALL sp_generate_monthly_invoice(?, ?)", [
    client_id,
    billing_month,
  ]);

  return NextResponse.json({ ok: true });
}
