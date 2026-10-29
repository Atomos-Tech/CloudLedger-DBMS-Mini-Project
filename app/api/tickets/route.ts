import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { auth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import { pgPool } from "@/lib/pgvector";
import { embedText } from "@/lib/embeddings";
import { createTicketSchema } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "Admin";
  const clientIds = session.user.clientIds ?? [];

  if (!isAdmin && clientIds.length === 0) {
    return NextResponse.json({ tickets: [] });
  }

  const pgResult = isAdmin
    ? await pgPool.query(
        `SELECT ticket_id, client_id, subject, body, created_at
         FROM support_tickets
         ORDER BY created_at DESC
         LIMIT 20`
      )
    : await pgPool.query(
        `SELECT ticket_id, client_id, subject, body, created_at
         FROM support_tickets
         WHERE client_id = ANY($1::int[])
         ORDER BY created_at DESC
         LIMIT 20`,
        [clientIds]
      );

  const [clientRows] = await mysqlPool.query<RowDataPacket[]>(
    "SELECT client_id, company_name FROM Clients"
  );
  const companyById = new Map(
    clientRows.map((c) => [Number(c.client_id), String(c.company_name)])
  );

  const tickets = pgResult.rows.map((row) => ({
    ...row,
    company_name: companyById.get(Number(row.client_id)) ?? `Client #${row.client_id}`,
  }));

  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "Admin";
  const clientIds = session.user.clientIds ?? [];

  const body = await request.json().catch(() => null);
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { client_id, subject, body: ticketBody } = parsed.data;

  if (!isAdmin && !clientIds.includes(client_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const embedding = await embedText(`${subject}\n\n${ticketBody}`);
  const vectorLiteral = `[${embedding.join(",")}]`;

  const result = await pgPool.query(
    `INSERT INTO support_tickets (client_id, subject, body, embedding)
     VALUES ($1, $2, $3, $4::vector)
     RETURNING ticket_id`,
    [client_id, subject, ticketBody, vectorLiteral]
  );

  return NextResponse.json({ ticket_id: result.rows[0].ticket_id }, { status: 201 });
}
