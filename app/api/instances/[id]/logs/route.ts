import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { auth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const instanceId = Number(id);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    return NextResponse.json({ error: "Invalid instance id" }, { status: 400 });
  }

  const isAdmin = session.user.role === "Admin";
  const clientIds = session.user.clientIds ?? [];

  const [instRows] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT si.instance_id, si.client_id, st.hourly_cost
     FROM Server_Instances si
     JOIN Subscription_Tiers st ON st.tier_id = si.tier_id
     WHERE si.instance_id = ? LIMIT 1`,
    [instanceId]
  );
  const instance = instRows[0];
  if (!instance) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isAdmin && !clientIds.includes(instance.client_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [logs] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT ul.log_id,
            ul.instance_id,
            ul.start_time,
            ul.end_time,
            TIMESTAMPDIFF(SECOND, ul.start_time, COALESCE(ul.end_time, NOW())) AS duration_seconds,
            ROUND(
              TIMESTAMPDIFF(SECOND, ul.start_time, COALESCE(ul.end_time, NOW())) / 3600.0 * ?,
              4
            ) AS accrued_cost
     FROM Usage_Logs ul
     WHERE ul.instance_id = ?
     ORDER BY ul.start_time DESC`,
    [instance.hourly_cost, instanceId]
  );

  return NextResponse.json({ logs });
}

