import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { auth } from "@/lib/auth";
import { mysqlPool } from "@/lib/mysql";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [regions] = await mysqlPool.query<RowDataPacket[]>(
    "SELECT region_id, region_name FROM Regions ORDER BY region_name"
  );

  const [dataCenters] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT dc.dc_id, dc.region_id, r.region_name, dc.facility_name, dc.operational_status
     FROM Data_Centers dc
     JOIN Regions r ON r.region_id = dc.region_id
     ORDER BY r.region_name, dc.facility_name`
  );

  const [tiers] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT tier_id, tier_name, cpu_cores, ram_gb, hourly_cost
     FROM Subscription_Tiers
     ORDER BY hourly_cost ASC`
  );

  return NextResponse.json({ regions, dataCenters, tiers });
}

