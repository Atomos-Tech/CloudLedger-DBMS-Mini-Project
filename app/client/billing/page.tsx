"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Receipt,
  Search,
  RefreshCw,
  CheckCircle2,
  MapPin,
  Wallet,
  AlertCircle,
  CheckCheck,
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

interface Invoice {
  invoice_id: number;
  client_id: number;
  company_name: string;
  billing_month: string;
  total_amount: string;
  payment_status: "Pending" | "Paid" | "Overdue";
}

interface ClientSummary {
  client_id: number;
  company_name: string;
  billing_address: string | null;
  account_status: "Active" | "Suspended" | "Closed";
  running_total: string | number;
}

const STATUS_VARIANT: Record<Invoice["payment_status"], "default" | "secondary" | "destructive"> = {
  Paid: "default",
  Pending: "secondary",
  Overdue: "destructive",
};

export default function ClientBillingPage() {
  const { data: session } = useSession();
  const canManageBilling =
    session?.user?.role === "Admin" || session?.user?.role === "Billing";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | Invoice["payment_status"]>("All");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Generate invoice modal state
  const [genOpen, setGenOpen] = useState(false);
  const [genClientId, setGenClientId] = useState<number>(0);
  const [genMonth, setGenMonth] = useState(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  });
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [invRes, cliRes] = await Promise.all([
      fetch("/api/invoices"),
      fetch("/api/clients"),
    ]);
    if (invRes.ok) {
      const data = await invRes.json();
      setInvoices(data.invoices ?? []);
    }
    if (cliRes.ok) {
      const cData = await cliRes.json();
      const list: ClientSummary[] = cData.clients ?? [];
      setClients(list);
      if (list.length > 0) {
        setGenClientId((prev) => prev || list[0].client_id);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleGenerateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!genClientId || !genMonth) return;
    setGenerating(true);
    const billingMonthDate = `${genMonth}-01`;
    const res = await fetch("/api/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Number(genClientId),
        billing_month: billingMonthDate,
      }),
    });
    setGenerating(false);
    if (res.ok) {
      toast.success(`Invoice generated/refreshed for ${genMonth} via sp_generate_monthly_invoice.`);
      setGenOpen(false);
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(typeof data?.error === "string" ? data.error : "Failed to generate invoice.");
    }
  }

  async function updatePaymentStatus(invoiceId: number, status: Invoice["payment_status"]) {
    setUpdatingId(invoiceId);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_status: status }),
    });
    setUpdatingId(null);
    if (res.ok) {
      toast.success(`Invoice #${invoiceId} marked as ${status}.`);
      await load();
    } else {
      toast.error("Failed to update invoice payment status.");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== "All" && inv.payment_status !== statusFilter) return false;
      if (!q) return true;
      return (
        inv.company_name.toLowerCase().includes(q) ||
        inv.payment_status.toLowerCase().includes(q) ||
        String(inv.invoice_id).includes(q)
      );
    });
  }, [invoices, search, statusFilter]);

  const totalPaid = invoices
    .filter((i) => i.payment_status === "Paid")
    .reduce((sum, i) => sum + Number(i.total_amount), 0);

  const totalDue = invoices
    .filter((i) => i.payment_status !== "Paid")
    .reduce((sum, i) => sum + Number(i.total_amount), 0);

  const currentRunningTotal = clients.reduce(
    (sum, c) => sum + Number(c.running_total ?? 0),
    0
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Billing &amp; Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Automated monthly invoice ledger generated from real server usage logs.
          </p>
        </div>
        {canManageBilling && (
          <Button size="lg" onClick={() => setGenOpen(true)} className="shadow-xs">
            <RefreshCw className="size-4" />
            Generate Monthly Invoice
          </Button>
        )}
      </div>

      {/* 3 FinOps Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-border/80 shadow-xs">
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Settled (Paid)</div>
              <div className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {invoices.filter((i) => i.payment_status === "Paid").length} settled invoices
              </div>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCheck className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                Outstanding Balance
              </div>
              <div className="font-mono text-2xl font-bold text-amber-600 dark:text-amber-400">
                ${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Pending &amp; Overdue invoices
              </div>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs">
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                Live Current-Month Accrual
              </div>
              <div className="font-mono text-2xl font-bold text-primary">
                ${currentRunningTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Real-time via <code>vw_client_current_bill</code>
              </div>
            </div>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Wallet className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client Billing Profiles */}
      {!loading && clients.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => (
            <Card key={c.client_id} size="sm" className="border-border/80 bg-card/70">
              <CardContent className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{c.company_name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {c.account_status}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" />
                    {c.billing_address || "No billing address on file"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-semibold">
                    ${Number(c.running_total ?? 0).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-muted-foreground">MTD Accrual</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client or invoice ID..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1">
          {(["All", "Paid", "Pending", "Overdue"] as const).map((tab) => (
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
          <Receipt className="size-9 text-muted-foreground" />
          <p className="text-sm font-semibold">No invoices found</p>
          <p className="text-xs text-muted-foreground">
            {invoices.length === 0
              ? "No invoices have been generated for this client yet."
              : "Try clearing the filter or search query."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Client Organization</TableHead>
                <TableHead>Billing Cycle</TableHead>
                <TableHead className="text-right">Total Snapshot</TableHead>
                <TableHead>Status</TableHead>
                {canManageBilling && <TableHead className="text-right">Settlement</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow key={inv.invoice_id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    INV-{String(inv.invoice_id).padStart(4, "0")}
                  </TableCell>
                  <TableCell className="font-semibold">{inv.company_name}</TableCell>
                  <TableCell>
                    {new Date(inv.billing_month).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                    })}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    ${Number(inv.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[inv.payment_status]}>
                      {inv.payment_status}
                    </Badge>
                  </TableCell>
                  {canManageBilling && (
                    <TableCell className="text-right">
                      {inv.payment_status !== "Paid" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={updatingId === inv.invoice_id}
                          onClick={() => updatePaymentStatus(inv.invoice_id, "Paid")}
                        >
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                          Mark Paid
                        </Button>
                      ) : (
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          ✓ Settled
                        </span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate / Refresh Monthly Invoice</DialogTitle>
            <DialogDescription>
              Executes <code>CALL sp_generate_monthly_invoice(client_id, billing_month)</code> inside an ACID transaction to sum usage logs and upsert the invoice.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGenerateInvoice} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gen-client">Client Organization (RECEIVES)</Label>
              <select
                id="gen-client"
                value={genClientId}
                onChange={(e) => setGenClientId(Number(e.target.value))}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
                required
              >
                {clients.map((c) => (
                  <option key={c.client_id} value={c.client_id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gen-month">Billing Month</Label>
              <Input
                id="gen-month"
                type="month"
                value={genMonth}
                onChange={(e) => setGenMonth(e.target.value)}
                required
              />
            </div>
            <DialogFooter showCloseButton>
              <Button type="submit" disabled={generating}>
                {generating ? "Running Procedure..." : "Run Stored Procedure"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
