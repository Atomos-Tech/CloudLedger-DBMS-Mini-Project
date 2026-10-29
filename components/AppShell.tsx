"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  CloudCog,
  LayoutDashboard,
  Server,
  Receipt,
  LifeBuoy,
  Menu,
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetHeader,
} from "@/components/ui/sheet";

type NavItem = {
  href: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin/dashboard",
    label: "Executive Dashboard",
    subtitle: "Fleet, revenue & IAM overview",
    icon: LayoutDashboard,
    adminOnly: true,
  },
  {
    href: "/client/instances",
    label: "Compute Instances",
    subtitle: "Provision & meter servers",
    icon: Server,
  },
  {
    href: "/client/billing",
    label: "Billing & Invoices",
    subtitle: "Monthly ledger & settlements",
    icon: Receipt,
  },
  {
    href: "/support",
    label: "AI Support Hub",
    subtitle: "pgvector semantic search",
    icon: LifeBuoy,
  },
];

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function roleBadgeVariant(role?: string) {
  if (role === "Admin") return "default" as const;
  if (role === "Billing") return "secondary" as const;
  return "outline" as const;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3 px-2 py-1">
      <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground shadow-sm">
        <CloudCog className="size-5" />
      </div>
      <div className="flex flex-col">
        <span className="font-heading text-base font-semibold tracking-tight text-sidebar-foreground">
          CloudLedger
        </span>
        <span className="text-[11px] text-sidebar-foreground/65">
          Cloud Infrastructure & FinOps
        </span>
      </div>
    </Link>
  );
}

function NavLinks({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-foreground/55 uppercase">
        Workspace Navigation
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-2xs"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              {active && (
                <span className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-primary" />
              )}
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-sidebar-accent/70 text-sidebar-foreground/75 group-hover:text-sidebar-foreground"
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium leading-tight">{item.label}</span>
                <span className="truncate text-[11px] text-sidebar-foreground/60">
                  {item.subtitle}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthRoute = pathname === "/login" || pathname === "/";
  if (!session?.user || isAuthRoute) {
    return <>{children}</>;
  }

  const isAdmin = session.user.role === "Admin";
  const currentNav = NAV_ITEMS.find((item) => pathname.startsWith(item.href));
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden w-68 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3.5 py-4 text-sidebar-foreground md:flex">
        <Brand />

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/60 px-3 py-2 text-xs text-sidebar-foreground">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <Database className="size-3.5 text-primary" />
          <span className="truncate font-medium">MySQL 8 + pgvector Online</span>
        </div>

        <div className="mt-6 flex-1">
          <NavLinks isAdmin={isAdmin} />
        </div>

        <div className="flex flex-col gap-2.5 border-t border-sidebar-border pt-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-sidebar-border bg-sidebar-accent px-3 py-2.5 text-sidebar-accent-foreground">
            <Avatar size="sm">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials(session.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-sidebar-accent-foreground">
                {session.user.name}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/70">
                {session.user.email}
              </span>
            </div>
            <span className="shrink-0 rounded-full border border-sidebar-border bg-sidebar px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground">
              {session.user.role}
            </span>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-rose-500/35 bg-rose-500/15 px-3 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-500/25 dark:text-rose-300"
          >
            <LogOut className="size-3.5 shrink-0" />
            <span>Sign out of CloudLedger</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area with Sticky Top Header */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-15 items-center justify-between gap-4 border-b border-border bg-card/90 px-4 backdrop-blur-md md:px-6">
          <div className="flex items-center gap-3">
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon-sm" />}>
                  <Menu className="size-5" />
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
                  <SheetHeader className="border-b border-sidebar-border p-4">
                    <SheetTitle className="text-sidebar-foreground">
                      <Brand />
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <NavLinks isAdmin={isAdmin} />
                    <div className="flex flex-col gap-3 border-t border-sidebar-border pt-4">
                      <div className="flex items-center justify-between text-xs text-sidebar-foreground">
                        <span className="font-medium">{session.user.name}</span>
                        <Badge variant={roleBadgeVariant(session.user.role)}>
                          {session.user.role}
                        </Badge>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                      >
                        <LogOut className="size-3.5" />
                        Sign out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="font-heading text-sm font-semibold text-foreground md:text-base">
                {currentNav?.label ?? "CloudLedger Console"}
              </span>
              {currentNav?.subtitle && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  · {currentNav.subtitle}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs sm:flex">
              <ShieldCheck className="size-3.5 text-primary" />
              <span className="font-medium text-foreground">{session.user.name}</span>
              <Badge variant={roleBadgeVariant(session.user.role)} className="text-[10px]">
                {session.user.role}
              </Badge>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Toggle theme"
              title="Switch between Light and Dark mode"
              className="gap-1.5 px-3"
            >
              {isDark ? (
                <>
                  <Moon className="size-3.5 shrink-0 text-indigo-400" />
                  <span className="text-xs">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="size-3.5 shrink-0 text-amber-500" />
                  <span className="text-xs">Light</span>
                </>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-3.5 shrink-0" />
              <span>Sign out</span>
            </Button>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
