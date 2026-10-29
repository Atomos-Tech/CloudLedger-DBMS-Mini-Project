import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { auth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import { pgPool } from "@/lib/pgvector";
import { embedText } from "@/lib/embeddings";
import { ticketSearchSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ticketSearchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { query, limit } = parsed.data;
  const isAdmin = session.user.role === "Admin";
  const clientIds = session.user.clientIds ?? [];

  if (!isAdmin && clientIds.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const embedding = await embedText(query);
  const vectorLiteral = `[${embedding.join(",")}]`;

  const result = isAdmin
    ? await pgPool.query(
        `SELECT ticket_id, client_id, subject, body, created_at,
                1 - (embedding <=> $1::vector) AS similarity
         FROM support_tickets
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vectorLiteral, limit]
      )
    : await pgPool.query(
        `SELECT ticket_id, client_id, subject, body, created_at,
                1 - (embedding <=> $1::vector) AS similarity
         FROM support_tickets
         WHERE client_id = ANY($2::int[])
         ORDER BY embedding <=> $1::vector
         LIMIT $3`,
        [vectorLiteral, clientIds, limit]
      );

  const [clientRows] = await mysqlPool.query<RowDataPacket[]>(
    "SELECT client_id, company_name FROM Clients"
  );
  const companyById = new Map(
    clientRows.map((c) => [Number(c.client_id), String(c.company_name)])
  );

  const results = result.rows.map((row) => ({
    ...row,
    company_name: companyById.get(Number(row.client_id)) ?? `Client #${row.client_id}`,
  }));

  return NextResponse.json({ results });
}
