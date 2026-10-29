"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Server,
  Search,
  Play,
  Square,
  XCircle,
  Plus,
  Clock,
  Cpu,
  Globe,
  Flame,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Instance {
  instance_id: number;
  client_id: number;
  company_name: string;
  account_status: "Active" | "Suspended" | "Closed";
  tier_id: number;
  tier_name: string;
  cpu_cores: number;
  ram_gb: number;
  hourly_cost: string;
  dc_id: number;
  facility_name: string;
  operational_status: "Active" | "Maintenance" | "Offline";
  region_id: number;
  region_name: string;
  current_status: "Running" | "Stopped" | "Terminated";
  created_at: string;
}

interface ClientOption {
  client_id: number;
  company_name: string;
  account_status: "Active" | "Suspended" | "Closed";
}

interface TierOption {
  tier_id: number;
  tier_name: string;
  cpu_cores: number;
  ram_gb: number;
  hourly_cost: string;
}

interface DataCenterOption {
  dc_id: number;
  region_id: number;
  region_name: string;
  facility_name: string;
  operational_status: "Active" | "Maintenance" | "Offline";
}

interface UsageLog {
  log_id: number;
  instance_id: number;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  accrued_cost: string;
}

const STATUS_VARIANT: Record<Instance["current_status"], "default" | "secondary" | "destructive"> = {
  Running: "default",
  Stopped: "secondary",
  Terminated: "destructive",
};

const DC_STATUS_VARIANT: Record<Instance["operational_status"], "default" | "secondary" | "destructive"> = {
  Active: "default",
  Maintenance: "secondary",
  Offline: "destructive",
};

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m ${s % 60}s`;
}

export default function ClientInstancesPage() {
  const { data: session } = useSession();
  const canMutate = session?.user?.role === "Admin" || session?.user?.role === "DevOps";

  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Instance["current_status"]>("All");
  const [terminateTarget, setTerminateTarget] = useState<Instance | null>(null);

  // Provision modal state
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [tiers, setTiers] = useState<TierOption[]>([]);
  const [dataCenters, setDataCenters] = useState<DataCenterOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number>(0);
  const [selectedTierId, setSelectedTierId] = useState<number>(0);
  const [selectedDcId, setSelectedDcId] = useState<number>(0);
  const [provisioning, setProvisioning] = useState(false);

  // Usage Logs modal state
  const [logsTarget, setLogsTarget] = useState<Instance | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/instances");
    if (res.ok) {
      const data = await res.json();
      setInstances(data.instances);
    } else {
      toast.error("Failed to load instances.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function openProvisionModal() {
    setProvisionOpen(true);
    const [clientsRes, infraRes] = await Promise.all([
      fetch("/api/clients"),
      fetch("/api/infrastructure"),
    ]);
    if (clientsRes.ok) {
      const cData = await clientsRes.json();
      const list: ClientOption[] = cData.clients ?? [];
      setClients(list);
      if (list.length > 0 && !selectedClientId) {
        setSelectedClientId(list[0].client_id);
      }
    }
    if (infraRes.ok) {
      const iData = await infraRes.json();
      const tList: TierOption[] = iData.tiers ?? [];
      const dcList: DataCenterOption[] = iData.dataCenters ?? [];
      setTiers(tList);
      setDataCenters(dcList);
      if (tList.length > 0 && !selectedTierId) {
        setSelectedTierId(tList[0].tier_id);
      }
      if (dcList.length > 0 && !selectedDcId) {
        setSelectedDcId(dcList[0].dc_id);
      }
    }
  }

  async function handleProvision(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClientId || !selectedTierId || !selectedDcId) return;
    setProvisioning(true);
    const res = await fetch("/api/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Number(selectedClientId),
        tier_id: Number(selectedTierId),
        dc_id: Number(selectedDcId),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setProvisioning(false);

    if (!res.ok) {
      toast.error(typeof data?.error === "string" ? data.error : "Provisioning failed.");
      return;
    }

    toast.success(`Instance #${data.instance_id} provisioned in Stopped state.`);
    setProvisionOpen(false);
    await load();
  }

  async function openUsageLogs(instance: Instance) {
    setLogsTarget(instance);
    setLogsLoading(true);
    const res = await fetch(`/api/instances/${instance.instance_id}/logs`);
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs ?? []);
    } else {
      toast.error("Failed to load usage logs.");
      setLogs([]);
    }
    setLogsLoading(false);
  }

  async function setStatus(instanceId: number, status: Instance["current_status"]) {
    setPendingId(instanceId);
    const res = await fetch(`/api/instances/${instanceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_status: status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data?.error === "string" ? data.error : "Update failed.");
    } else {
      toast.success(`Instance #${instanceId} is now ${status}.`);
    }
    await load();
    setPendingId(null);
  }

  const counts = useMemo(() => {
    const running = instances.filter((i) => i.current_status === "Running");
    const stopped = instances.filter((i) => i.current_status === "Stopped");
    const terminated = instances.filter((i) => i.current_status === "Terminated");
    const burnRate = running.reduce((sum, i) => sum + Number(i.hourly_cost), 0);
    return {
      running: running.length,
      stopped: stopped.length,
      terminated: terminated.length,
      burnRate,
    };
  }, [instances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return instances.filter((i) => {
      if (statusFilter !== "All" && i.current_status !== statusFilter) return false;
      if (!q) return true;
      return (
        i.company_name.toLowerCase().includes(q) ||
        i.tier_name.toLowerCase().includes(q) ||
        i.facility_name.toLowerCase().includes(q) ||
        i.region_name?.toLowerCase().includes(q) ||
        String(i.instance_id).includes(q)
      );
    });
  }, [instances, search, statusFilter]);

  const totalLogAccrual = useMemo(
    () => logs.reduce((sum, l) => sum + Number(l.accrued_cost ?? 0), 0),
    [logs]
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Compute Instances</h1>
          <p className="text-sm text-muted-foreground">
            Provision virtual servers across global regions, manage lifecycle states, and inspect metered usage logs.
          </p>
        </div>
        {canMutate && (
          <Button size="lg" onClick={openProvisionModal} className="shadow-xs">
            <Plus className="size-4" />
            Provision New Instance
          </Button>
        )}
      </div>

      {/* 4 Telemetry Strip Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card size="sm" className="border-border/80 shadow-xs">
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Running</div>
              <div className="font-heading text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {counts.running}
              </div>
            </div>
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Activity className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className="border-border/80 shadow-xs">
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Stopped</div>
              <div className="font-heading text-xl font-bold text-amber-600 dark:text-amber-400">
                {counts.stopped}
              </div>
            </div>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Square className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className="border-border/80 shadow-xs">
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Terminated</div>
              <div className="font-heading text-xl font-bold text-rose-600 dark:text-rose-400">
                {counts.terminated}
              </div>
            </div>
            <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <XCircle className="size-4" />
            </div>
          </CardContent>
        </Card>

        <Card size="sm" className="border-border/80 shadow-xs">
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Active Burn Rate</div>
              <div className="font-mono text-xl font-bold">
                ${counts.burnRate.toFixed(4)}
                <span className="text-xs font-normal text-muted-foreground">/hr</span>
              </div>
            </div>
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Flame className="size-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, client, region, tier..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {(["All", "Running", "Stopped", "Terminated"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === tab
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <Server className="size-9 text-muted-foreground" />
          <p className="text-sm font-semibold">No matching instances</p>
          <p className="text-xs text-muted-foreground">
            {instances.length === 0
              ? "No server instances have been provisioned for your client scope yet."
              : "Try clearing the status filter or search query."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Tier &amp; Specs</TableHead>
                <TableHead>Data Center &amp; Region</TableHead>
                <TableHead>Provisioned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Lifecycle &amp; Logs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.instance_id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{i.instance_id}
                  </TableCell>
                  <TableCell className="font-semibold">{i.company_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Cpu className="size-3.5 text-primary" />
                      {i.tier_name}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {i.cpu_cores} vCPU · {i.ram_gb} GB · ${Number(i.hourly_cost).toFixed(4)}/hr
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium">
                      <span>{i.facility_name}</span>
                      <Badge
                        variant={DC_STATUS_VARIANT[i.operational_status]}
                        className="text-[10px]"
                      >
                        {i.operational_status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <Globe className="size-3" />
                      {i.region_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(i.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[i.current_status]} className="gap-1.5">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          i.current_status === "Running"
                            ? "bg-emerald-300 animate-pulse"
                            : i.current_status === "Stopped"
                              ? "bg-amber-400"
                              : "bg-rose-200"
                        )}
                      />
                      {i.current_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUsageLogs(i)}
                        title="View metered usage logs"
                      >
                        <Clock className="size-3.5" />
                        Logs
                      </Button>
                      {canMutate && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={
                              i.current_status === "Running" ||
                              i.current_status === "Terminated" ||
                              pendingId === i.instance_id
                            }
                            onClick={() => setStatus(i.instance_id, "Running")}
                          >
                            <Play className="size-3.5" />
                            Start
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={i.current_status !== "Running" || pendingId === i.instance_id}
                            onClick={() => setStatus(i.instance_id, "Stopped")}
                          >
                            <Square className="size-3.5" />
                            Stop
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={
                              i.current_status === "Terminated" || pendingId === i.instance_id
                            }
                            onClick={() => setTerminateTarget(i)}
                          >
                            <XCircle className="size-3.5" />
                            Terminate
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Provision Instance Dialog with Interactive Tier & DC Cards */}
      <Dialog open={provisionOpen} onOpenChange={setProvisionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Provision Server Instance</DialogTitle>
            <DialogDescription>
              Choose a client organization, compute tier, and regional data center facility.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleProvision} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prov-client">1. Client Account (OWNS)</Label>
              <select
                id="prov-client"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(Number(e.target.value))}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
                required
              >
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id}>
                    {c.company_name} ({c.account_status})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>2. Subscription Tier (DEFINES)</Label>
              <div className="grid grid-cols-2 gap-2">
                {tiers.map((t) => {
                  const active = selectedTierId === t.tier_id;
                  return (
                    <button
                      key={t.tier_id}
                      type="button"
                      onClick={() => setSelectedTierId(t.tier_id)}
                      className={cn(
                        "flex flex-col gap-1 rounded-xl border p-3 text-left transition-all",
                        active
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{t.tier_name}</span>
                        <span className="font-mono text-xs font-semibold text-primary">
                          ${Number(t.hourly_cost).toFixed(4)}/hr
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {t.cpu_cores} vCPU · {t.ram_gb} GB RAM
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>3. Regional Data Center (HOSTS / CONTAINS)</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {dataCenters.map((dc) => {
                  const active = selectedDcId === dc.dc_id;
                  return (
                    <button
                      key={dc.dc_id}
                      type="button"
                      onClick={() => setSelectedDcId(dc.dc_id)}
                      className={cn(
                        "flex flex-col gap-1 rounded-xl border p-2.5 text-left transition-all",
                        active
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-semibold">{dc.facility_name}</span>
                        <Badge
                          variant={DC_STATUS_VARIANT[dc.operational_status]}
                          className="text-[10px]"
                        >
                          {dc.operational_status}
                        </Badge>
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {dc.region_name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <DialogFooter showCloseButton>
              <Button type="submit" disabled={provisioning}>
                {provisioning ? "Provisioning..." : "Deploy Instance"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Usage Logs Dialog */}
      <Dialog open={!!logsTarget} onOpenChange={(open) => !open && setLogsTarget(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Usage Logs — Instance #{logsTarget?.instance_id} ({logsTarget?.company_name})
            </DialogTitle>
            <DialogDescription>
              {logsTarget?.tier_name} Tier (${Number(logsTarget?.hourly_cost ?? 0).toFixed(4)}/hr) · Closed automatically on Stop/Terminate via <code>trg_close_usage_log_on_stop</code>.
            </DialogDescription>
          </DialogHeader>

          {!logsLoading && logs.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-xs">
              <span>
                Total Recorded Sessions: <strong>{logs.length}</strong>
              </span>
              <span>
                Cumulative Accrued Cost:{" "}
                <strong className="font-mono text-sm text-primary">
                  ${totalLogAccrual.toFixed(2)}
                </strong>
              </span>
            </div>
          )}

          {logsLoading ? (
            <div className="flex flex-col gap-2 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No usage log sessions recorded for this instance yet. Start the instance to begin metering.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Log ID</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Accrued</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.log_id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        #{log.log_id}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(log.start_time).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.end_time ? (
                          new Date(log.end_time).toLocaleString()
                        ) : (
                          <Badge variant="default" className="text-[10px]">
                            Active (Metering)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatDuration(log.duration_seconds)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ${Number(log.accrued_cost).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!terminateTarget}
        onOpenChange={(open) => !open && setTerminateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminate instance #{terminateTarget?.instance_id}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently terminate the instance for {terminateTarget?.company_name} and close any open usage log. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (terminateTarget) setStatus(terminateTarget.instance_id, "Terminated");
                setTerminateTarget(null);
              }}
            >
              Terminate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
