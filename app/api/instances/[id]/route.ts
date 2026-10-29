import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { auth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";
import { updateInstanceStatusSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
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

  const body = await request.json().catch(() => null);
  const parsed = updateInstanceStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const role = session.user.role;
  if (role !== "Admin" && role !== "DevOps") {
    return NextResponse.json(
      { error: "Only Admin or DevOps roles can modify instances." },
      { status: 403 }
    );
  }

  const isAdmin = role === "Admin";
  const clientIds = session.user.clientIds ?? [];

  const [rows] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT si.client_id, si.current_status, c.account_status, dc.operational_status, dc.facility_name
     FROM Server_Instances si
     JOIN Clients c ON c.client_id = si.client_id
     JOIN Data_Centers dc ON dc.dc_id = si.dc_id
     WHERE si.instance_id = ? LIMIT 1`,
    [instanceId]
  );
  const instance = rows[0];
  if (!instance) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isAdmin && !clientIds.includes(instance.client_id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (instance.current_status === "Terminated") {
    return NextResponse.json(
      { error: "Cannot change the status of a Terminated instance." },
      { status: 422 }
    );
  }

  const nextStatus = parsed.data.current_status;
  if (instance.current_status === nextStatus) {
    return NextResponse.json({ ok: true });
  }

  if (nextStatus === "Running") {
    if (instance.account_status !== "Active") {
      return NextResponse.json(
        { error: `Cannot start instance while client account is '${instance.account_status}'.` },
        { status: 422 }
      );
    }
    if (instance.operational_status !== "Active") {
      return NextResponse.json(
        {
          error: `Cannot start instance in ${instance.facility_name} while data center is '${instance.operational_status}'.`,
        },
        { status: 422 }
      );
    }
  }

  await mysqlPool.query(
    "UPDATE Server_Instances SET current_status = ? WHERE instance_id = ?",
    [nextStatus, instanceId]
  );

  // trg_close_usage_log_on_stop closes any open Usage_Logs row automatically.
  // If transitioning to Running from Stopped, open a fresh usage log entry.
  if (nextStatus === "Running") {
    await mysqlPool.query(
      "INSERT INTO Usage_Logs (instance_id, start_time) VALUES (?, NOW())",
      [instanceId]
    );
  }

  return NextResponse.json({ ok: true });
}
