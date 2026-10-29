"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CloudCog,
  ShieldCheck,
  Server,
  Receipt,
  ArrowRight,
  Lock,
  Mail,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const DEMO_ACCOUNTS = [
  {
    name: "Ada Ng",
    email: "admin@cloudledger.dev",
    role: "Admin",
    scope: "Global — All 8 Clients",
    landing: "/admin/dashboard",
    icon: ShieldCheck,
  },
  {
    name: "Bilal Rahman",
    email: "bilal@cloudledger.dev",
    role: "DevOps",
    scope: "Initech LLC",
    landing: "/client/instances",
    icon: Server,
  },
  {
    name: "Carmen Diaz",
    email: "carmen@cloudledger.dev",
    role: "Billing",
    scope: "Globex Corporation",
    landing: "/client/billing",
    icon: Receipt,
  },
  {
    name: "Devon Okafor",
    email: "devon@cloudledger.dev",
    role: "DevOps",
    scope: "Hooli Cloud",
    landing: "/client/instances",
    icon: Server,
  },
];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const explicitCallback = searchParams.get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function performLogin(targetEmail: string, targetPassword: string) {
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email: targetEmail,
      password: targetPassword,
      redirect: false,
    });

    if (result?.error) {
      setLoading(false);
      const message = "Invalid email or password.";
      setError(message);
      toast.error(message);
      return;
    }

    toast.success("Signed in to CloudLedger.");
    const matchedAccount = DEMO_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === targetEmail.trim().toLowerCase()
    );
    const destination =
      explicitCallback ?? matchedAccount?.landing ?? "/client/instances";
    window.location.href = destination;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await performLogin(email, password);
  }

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-background px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-md">
              <CloudCog className="size-5.5" />
            </div>
            <span className="font-heading text-xl font-bold tracking-tight">CloudLedger</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            Enterprise Cloud Resource Allocation, Automated Billing &amp; Vector Support
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <Card className="border-border/80 shadow-lg md:col-span-6">
            <CardHeader>
              <CardTitle className="text-xl">Sign in to your console</CardTitle>
              <CardDescription>
                Enter your employee credentials or pick a role account on the right.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@cloudledger.dev"
                      className="pl-9"
                      aria-invalid={!!error}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="pl-9"
                      aria-invalid={!!error}
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
                  {loading ? "Authenticating..." : "Sign in"}
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-muted/30 md:col-span-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="size-4 text-primary" />
                  Instant Demo Accounts
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Password123!
                </Badge>
              </div>
              <CardDescription>
                Click any seeded IAM employee below to sign in immediately with that role and client scope.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {DEMO_ACCOUNTS.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.email}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setEmail(a.email);
                      setPassword("Password123!");
                      performLogin(a.email, "Password123!");
                    }}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/50 hover:shadow-sm disabled:opacity-50"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {a.name}
                          </span>
                          <Badge
                            variant={a.role === "Admin" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {a.role}
                          </Badge>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {a.email} · <span className="font-medium">{a.scope}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
