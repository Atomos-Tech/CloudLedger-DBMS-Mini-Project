import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  CloudCog,
  Server,
  Receipt,
  ShieldCheck,
  Search,
  ArrowRight,
  Database,
  Sparkles,
  Activity,
} from "lucide-react";

const FEATURES = [
  {
    icon: Server,
    badge: "MySQL 8 + Triggers",
    title: "Compute Instance Provisioning",
    description:
      "Deploy virtual instances across global regions, data centers, and CPU/RAM subscription tiers with automated usage log metering.",
  },
  {
    icon: Receipt,
    badge: "Stored Procedures & Views",
    title: "Automated FinOps Billing",
    description:
      "Generate monthly invoices transactionally via sp_generate_monthly_invoice and monitor live month-to-date spend via vw_client_current_bill.",
  },
  {
    icon: Search,
    badge: "PostgreSQL + pgvector",
    title: "AI Semantic Ticket Search",
    description:
      "384-dimensional all-MiniLM-L6-v2 embeddings surface historically similar support resolutions by meaning rather than exact keywords.",
  },
  {
    icon: ShieldCheck,
    badge: "Ternary IAM Mapping",
    title: "Multi-Tenant Role Enforcement",
    description:
      "Admin, DevOps, and Billing permissions are mapped per client in Client_Access_Mapping and verified on every route.",
  },
];

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect(session.user.role === "Admin" ? "/admin/dashboard" : "/client/instances");
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-sm">
            <CloudCog className="size-5" />
          </div>
          <span className="font-heading text-lg font-bold tracking-tight">CloudLedger</span>
        </div>
        <div className="flex items-center gap-3">
          <Button nativeButton={false} render={<Link href="/login" />}>
            Sign in to Console
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 pt-16 pb-16 text-center md:pt-24 md:pb-20">
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            <span>Hybrid Relational (MySQL 8) + Vector (PostgreSQL pgvector) Architecture</span>
          </div>

          <h1 className="text-balance font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            One ledger for every instance, invoice, and support ticket.
          </h1>

          <p className="max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
            CloudLedger pairs ACID-compliant relational billing and database triggers with
            local neural embeddings — giving Admin, DevOps, and Billing teams a unified
            cloud operations console.
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/login" />}>
              Launch Console &amp; Demo Accounts
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <div className="mt-6 grid w-full max-w-2xl grid-cols-3 gap-3 rounded-2xl border border-border/80 bg-card/70 p-4 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Database className="size-3.5 text-primary" />
                Relational Store
              </div>
              <span className="font-heading text-base font-semibold">10 MySQL Entities</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 border-x border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Activity className="size-3.5 text-primary" />
                DB Guarantees
              </div>
              <span className="font-heading text-base font-semibold">Triggers, View &amp; SP</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Semantic Store
              </div>
              <span className="font-heading text-base font-semibold">384-Dim pgvector</span>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="border-border/80 transition-all hover:border-primary/40 hover:shadow-md">
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <f.icon className="size-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {f.badge}
                  </Badge>
                </div>
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="leading-relaxed">{f.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t border-border bg-muted/30 px-6 py-6 text-center text-xs text-muted-foreground">
        CloudLedger — Cloud Infrastructure Allocation &amp; Automated Billing Platform
      </footer>
    </div>
  );
}
