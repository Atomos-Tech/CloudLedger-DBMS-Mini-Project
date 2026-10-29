import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { auth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import { createInstanceSchema } from "@/lib/validation";

function scopedWhere(isAdmin: boolean, clientIds: number[]) {
  if (isAdmin) return { clause: "1=1", params: [] as number[] };
  if (clientIds.length === 0) return { clause: "1=0", params: [] };
  return { clause: `si.client_id IN (?)`, params: [clientIds] };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "Admin";
  const { clause, params } = scopedWhere(isAdmin, session.user.clientIds ?? []);

  const [rows] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT si.instance_id, si.client_id, c.company_name, c.account_status,
            si.tier_id, st.tier_name, st.cpu_cores, st.ram_gb, st.hourly_cost,
            si.dc_id, dc.facility_name, dc.operational_status,
            r.region_id, r.region_name,
            si.current_status, si.created_at
     FROM Server_Instances si
     JOIN Clients c ON c.client_id = si.client_id
     JOIN Subscription_Tiers st ON st.tier_id = si.tier_id
     JOIN Data_Centers dc ON dc.dc_id = si.dc_id
     JOIN Regions r ON r.region_id = dc.region_id
     WHERE ${clause}
     ORDER BY si.created_at DESC`,
    params
  );

  return NextResponse.json({ instances: rows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "Admin" && role !== "DevOps") {
    return NextResponse.json(
      { error: "Only Admin or DevOps roles can provision instances." },
      { status: 403 }
    );
  }

  const isAdmin = role === "Admin";
  const clientIds = session.user.clientIds ?? [];

  const body = await request.json().catch(() => null);
  const parsed = createInstanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { client_id, tier_id, dc_id } = parsed.data;

  if (!isAdmin && !clientIds.includes(client_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [dcRows] = await mysqlPool.query<RowDataPacket[]>(
    "SELECT operational_status, facility_name FROM Data_Centers WHERE dc_id = ? LIMIT 1",
    [dc_id]
  );
  const dc = dcRows[0];
  if (!dc) {
    return NextResponse.json({ error: "Data center not found" }, { status: 404 });
  }
  if (dc.operational_status !== "Active") {
    return NextResponse.json(
      {
        error: `Cannot provision instance in ${dc.facility_name} while its operational status is '${dc.operational_status}'.`,
      },
      { status: 422 }
    );
  }

  try {
    const [result] = await mysqlPool.query(
      `INSERT INTO Server_Instances (client_id, tier_id, dc_id, current_status)
       VALUES (?, ?, ?, 'Stopped')`,
      [client_id, tier_id, dc_id]
    );
    const insertId = (result as { insertId: number }).insertId;
    return NextResponse.json({ instance_id: insertId }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Insert failed";
    // trg_prevent_deploy_suspended_client raises SIGNAL 45000 for suspended clients
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
