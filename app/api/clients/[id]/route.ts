import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import { updateClientSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const clientId = Number(id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateClientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { account_status, billing_address } = parsed.data;
  if (account_status === undefined && billing_address === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  if (account_status !== undefined && billing_address !== undefined) {
    await mysqlPool.query(
      "UPDATE Clients SET account_status = ?, billing_address = ? WHERE client_id = ?",
      [account_status, billing_address, clientId]
    );
  } else if (account_status !== undefined) {
    await mysqlPool.query(
      "UPDATE Clients SET account_status = ? WHERE client_id = ?",
      [account_status, clientId]
    );
  } else if (billing_address !== undefined) {
    await mysqlPool.query(
      "UPDATE Clients SET billing_address = ? WHERE client_id = ?",
      [billing_address, clientId]
    );
  }

  return NextResponse.json({ ok: true });
}

