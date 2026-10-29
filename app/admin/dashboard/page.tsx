import Link from "next/link";
import { mysqlPool } from "@/lib/mysql";
import type { RowDataPacket } from "mysql2";
import {
  Building2,
  Server,
  Wallet,
  Globe,
  ShieldCheck,
  Cpu,
  TrendingUp,
  MapPin,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RevenueChart, StatusChart } from "@/components/dashboard/charts";
import { ClientStatusSelect } from "@/components/dashboard/client-status-select";

const STATUS_DOT: Record<string, string> = {
  Running: "bg-emerald-500",
  Stopped: "bg-amber-500",
  Terminated: "bg-rose-500",
};

const DC_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Active: "default",
  Maintenance: "secondary",
  Offline: "destructive",
};

async function getOverview() {
  const [clients] = await mysqlPool.query<RowDataPacket[]>(
    "SELECT client_id, company_name, billing_address, account_status FROM Clients ORDER BY company_name"
  );
  const [instanceCounts] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT current_status, COUNT(*) AS count FROM Server_Instances GROUP BY current_status`
  );
  const [bill] = await mysqlPool.query<RowDataPacket[]>(
    "SELECT client_id, company_name, running_total FROM vw_client_current_bill ORDER BY running_total DESC"
  );
  const [revenue] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT billing_month, SUM(total_amount) AS revenue
     FROM Invoices WHERE payment_status = 'Paid'
     GROUP BY billing_month ORDER BY billing_month ASC`
  );
  const [dataCenters] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT dc.dc_id, dc.facility_name, dc.operational_status, r.region_id, r.region_name,
            COUNT(si.instance_id) AS instance_count
     FROM Data_Centers dc
     JOIN Regions r ON r.region_id = dc.region_id
     LEFT JOIN Server_Instances si ON si.dc_id = dc.dc_id
     GROUP BY dc.dc_id, dc.facility_name, dc.operational_status, r.region_id, r.region_name
     ORDER BY r.region_name, dc.facility_name`
  );
  const [tiers] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT st.tier_id, st.tier_name, st.cpu_cores, st.ram_gb, st.hourly_cost,
            COUNT(si.instance_id) AS instance_count
     FROM Subscription_Tiers st
     LEFT JOIN Server_Instances si ON si.tier_id = st.tier_id
     GROUP BY st.tier_id, st.tier_name, st.cpu_cores, st.ram_gb, st.hourly_cost
     ORDER BY st.hourly_cost ASC`
  );
  const [iamRows] = await mysqlPool.query<RowDataPacket[]>(
    `SELECT e.employee_id, e.first_name, e.last_name, e.email, e.created_at,
            r.role_name,
            GROUP_CONCAT(c.company_name ORDER BY c.company_name SEPARATOR ', ') AS mapped_clients,
            COUNT(cam.client_id) AS client_count
     FROM Employees e
     LEFT JOIN Client_Access_Mapping cam ON cam.employee_id = e.employee_id
     LEFT JOIN Roles r ON r.role_id = cam.role_id
     LEFT JOIN Clients c ON c.client_id = cam.client_id
     GROUP BY e.employee_id, e.first_name, e.last_name, e.email, e.created_at, r.role_name
     ORDER BY e.employee_id`
  );

  return { clients, instanceCounts, bill, revenue, dataCenters, tiers, iamRows };
}

export default async function AdminDashboardPage() {
  const { clients, instanceCounts, bill, revenue, dataCenters, tiers, iamRows } =
    await getOverview();

  const totalInstances = instanceCounts.reduce((sum, r) => sum + Number(r.count), 0);
  const activeInstances = Number(
    instanceCounts.find((r) => r.current_status === "Running")?.count ?? 0
  );
  const activeClients = clients.filter((c) => c.account_status === "Active").length;
  const suspendedClients = clients.filter((c) => c.account_status === "Suspended").length;
  const mrr = bill.reduce((sum, b) => sum + Number(b.running_total), 0);
  const totalSettledRevenue = revenue.reduce((sum, r) => sum + Number(r.revenue), 0);

  const billByClient = new Map(bill.map((b) => [b.client_id, Number(b.running_total)]));

  const revenueData = revenue.map((r) => ({
    month: new Date(r.billing_month).toLocaleDateString(undefined, {
      month: "short",
      year: "2-digit",
    }),
    revenue: Number(r.revenue),
  }));

  const statusData = instanceCounts.map((r) => ({
    status: String(r.current_status),
    count: Number(r.count),
  }));

  const utilizationPct =
    totalInstances > 0 ? Math.round((activeInstances / totalInstances) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      {/* Page Hero Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/80 bg-gradient-to-r from-primary/10 via-card to-card p-5 shadow-xs">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-[10px]">
              Global Admin Control Plane
            </Badge>
            <span className="text-xs text-muted-foreground">
              10 MySQL Relational Entities · 1 pgvector Weak Entity
            </span>
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Cloud Infrastructure &amp; FinOps Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Real-time telemetry across client accounts, regional data centers, compute tiers, and IAM policies.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/client/instances" />}>
            Manage Instances
            <ArrowUpRight className="size-3.5" />
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/client/billing" />}>
            Billing &amp; Invoices
            <ArrowUpRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80 shadow-xs">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Client Accounts</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-2xl font-bold">{clients.length}</span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                {activeClients} Active
              </span>
              {suspendedClients > 0 && (
                <span className="text-xs text-rose-500">· {suspendedClients} Suspended</span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Trigger blocks deployments on Suspended accounts
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Compute Fleet</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Server className="size-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="font-heading text-2xl font-bold">{activeInstances}</span>
                <span className="text-sm text-muted-foreground"> / {totalInstances} running</span>
              </div>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {utilizationPct}% active
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${utilizationPct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Current-Month Accrual
              </span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Wallet className="size-4" />
              </div>
            </div>
            <div className="font-heading text-2xl font-bold">
              ${mrr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Computed live via <code>vw_client_current_bill</code>
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Settled Revenue</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <TrendingUp className="size-4" />
              </div>
            </div>
            <div className="font-heading text-2xl font-bold">
              ${totalSettledRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Sum of settled <code>Paid</code> invoices across cycles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="border-border/80 shadow-xs lg:col-span-3">
          <CardHeader>
            <CardTitle>Paid Revenue by Billing Month</CardTitle>
            <CardDescription>
              Historical settled invoices generated via <code>sp_generate_monthly_invoice</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueData} />
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs lg:col-span-2">
          <CardHeader>
            <CardTitle>Fleet Status Breakdown</CardTitle>
            <CardDescription>{totalInstances} provisioned instances across all clients.</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusChart data={statusData} />
            <div className="mt-2 flex flex-wrap justify-center gap-4">
              {statusData.map((s) => (
                <div key={s.status} className="flex items-center gap-1.5 text-xs font-medium">
                  <span className={`size-2.5 rounded-full ${STATUS_DOT[s.status] ?? "bg-primary"}`} />
                  <span>{s.status}</span>
                  <span className="text-muted-foreground">({s.count})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* All Clients Table */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Client Organizations (Clients)</CardTitle>
              <CardDescription>
                Manage account status (<code>Active</code> / <code>Suspended</code> / <code>Closed</code>) and monitor live monthly accrual.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {clients.length} Organizations
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Billing Address</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead className="text-right">Current-Month Running Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => {
                  const runningAmt = billByClient.get(c.client_id) ?? 0;
                  return (
                    <TableRow key={c.client_id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{c.client_id}
                      </TableCell>
                      <TableCell className="font-semibold">{c.company_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3 text-muted-foreground/70" />
                          {c.billing_address ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ClientStatusSelect
                          clientId={Number(c.client_id)}
                          companyName={String(c.company_name)}
                          initialStatus={c.account_status as "Active" | "Suspended" | "Closed"}
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ${runningAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Infrastructure & Subscription Tiers */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border/80 shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              Regions &amp; Data Centers
            </CardTitle>
            <CardDescription>
              <code>Regions</code> (1) — CONTAINS — (N) <code>Data_Centers</code> (1) — HOSTS — (N) <code>Server_Instances</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>DC</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Facility</TableHead>
                    <TableHead>Operational Status</TableHead>
                    <TableHead className="text-right">Hosted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dataCenters.map((dc) => (
                    <TableRow key={dc.dc_id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{dc.dc_id}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {dc.region_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{dc.facility_name}</TableCell>
                      <TableCell>
                        <Badge variant={DC_STATUS_VARIANT[dc.operational_status as string] ?? "outline"}>
                          {dc.operational_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {dc.instance_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="size-4 text-primary" />
              Subscription Tiers Catalog
            </CardTitle>
            <CardDescription>
              <code>Subscription_Tiers</code> (1) — DEFINES — (N) <code>Server_Instances</code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead>CPU Cores</TableHead>
                    <TableHead>Memory</TableHead>
                    <TableHead>Hourly Rate</TableHead>
                    <TableHead className="text-right">Active Fleet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((t) => (
                    <TableRow key={t.tier_id}>
                      <TableCell className="font-semibold">{t.tier_name}</TableCell>
                      <TableCell className="text-xs">{t.cpu_cores} vCPU</TableCell>
                      <TableCell className="text-xs">{t.ram_gb} GB RAM</TableCell>
                      <TableCell className="font-mono text-xs font-medium">
                        ${Number(t.hourly_cost).toFixed(4)}/hr
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {t.instance_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* IAM Access Matrix */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            IAM Access Matrix (Employees × Roles × Clients)
          </CardTitle>
          <CardDescription>
            Ternary <code>ACCESS GRANTED</code> relationship resolved via <code>Client_Access_Mapping</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Granted Client Scope</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {iamRows.map((row) => (
                  <TableRow key={`${row.employee_id}-${row.role_name}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      #{row.employee_id}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {row.first_name} {row.last_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.role_name === "Admin" ? "default" : "secondary"}>
                        {row.role_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {Number(row.client_count) === clients.length ? (
                        <span className="font-medium text-foreground">
                          Global Access — All {clients.length} Clients
                        </span>
                      ) : (
                        row.mapped_clients
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
