"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { LogoMark, Wordmark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MOBILE_NAV, visibleGroups, type NavGroup } from "@/components/layout/nav-items";
import { cn, initials } from "@/lib/utils";
import { formatDate, formatWeekday } from "@/lib/date";
import type { Profile } from "@/lib/types";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  groups,
  pathname,
  collapsed,
  onNavigate,
}: {
  groups: NavGroup[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-6" aria-label="Main navigation">
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed ? (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              {group.label}
            </p>
          ) : (
            <div className="mx-auto mb-2 h-px w-6 bg-border" />
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-10 items-center gap-3 rounded-xl text-[13px] font-medium transition-colors",
                      collapsed ? "justify-center px-0" : "px-3",
                      active
                        ? "bg-primary/[0.09] text-foreground"
                        : "text-muted-foreground hover:bg-surface-2/70 hover:text-foreground",
                    )}
                  >
                    {active ? (
                      <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-primary" />
                    ) : null}
                    <Icon
                      className={cn(
                        "size-[17px] shrink-0 transition-colors",
                        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserCard({
  profile,
  email,
  collapsed,
  onNavigate,
}: {
  profile: Profile;
  email: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/70 bg-surface-2/40",
        collapsed ? "flex justify-center p-2" : "p-3",
      )}
    >
      <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-xs font-bold text-secondary">
          {initials(profile.display_name)}
        </span>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{profile.display_name ?? "LOCKIN user"}</p>
            <p className="truncate text-[10px] text-muted-foreground">{email}</p>
          </div>
        ) : null}
        {!collapsed ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                aria-label="Workspace menu"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-52">
              <DropdownMenuLabel>Workspace</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link href="/settings" onClick={onNavigate}>
                  <Settings /> Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {!collapsed ? (
        <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
          <ShieldCheck className="size-3 text-primary/70" />
          Private to this device
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({
  profile,
  email,
  today,
  children,
}: {
  profile: Profile;
  email: string;
  today: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const groups = React.useMemo(() => visibleGroups(profile.modules), [profile.modules]);

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("lockin-sidebar-collapsed") === "true");
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value;
      try {
        window.localStorage.setItem("lockin-sidebar-collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const currentLabel =
    groups.flatMap((g) => g.items).find((item) => isActive(pathname, item.href))?.shortLabel ??
    groups.flatMap((g) => g.items).find((item) => isActive(pathname, item.href))?.label ??
    "LOCKIN";

  return (
    <div className="mesh-bg min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border/70 bg-surface/70 transition-[width] duration-300 lg:flex",
          collapsed ? "w-[78px]" : "w-[264px]",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-border/60",
            collapsed ? "justify-center px-2" : "justify-between px-4",
          )}
        >
          <Link href="/dashboard" aria-label="LOCKIN dashboard" className="flex items-center">
            {collapsed ? <LogoMark size={32} /> : <Wordmark />}
          </Link>
          {!collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-5">
          <NavLinks groups={groups} pathname={pathname} collapsed={collapsed} />
        </div>

        <div className="border-t border-border/60 p-2.5">
          {!collapsed ? (
            <div className="mb-2.5 rounded-xl border border-primary/15 bg-primary/[0.05] p-3">
              <p className="text-[11px] font-semibold text-primary">Two-minute rule</p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                Log the day as it happened. Progress beats perfection.
              </p>
              <Link
                href="/check-in"
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-foreground hover:text-primary"
              >
                <Sparkles className="size-3" /> Start check-in
              </Link>
            </div>
          ) : null}
          <UserCard profile={profile} email={email} collapsed={collapsed} />
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="mt-2 flex w-full justify-center rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          ) : null}
        </div>
      </aside>

      <div
        className={cn(
          "transition-[padding] duration-300 print:pl-0",
          collapsed ? "lg:pl-[78px]" : "lg:pl-[264px]",
        )}
      >
        <header className="no-print sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="size-5" />
              </Button>
              <Link href="/dashboard" className="lg:hidden" aria-label="LOCKIN dashboard">
                <LogoMark size={30} />
              </Link>
              <div className="hidden min-w-0 sm:block">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {formatWeekday(today, "long")} · {formatDate(today, "MMM d, yyyy")}
                </p>
                <p className="truncate font-display text-sm font-semibold">{currentLabel}</p>
              </div>
              <p className="truncate font-display text-sm font-semibold sm:hidden">{currentLabel}</p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button asChild size="sm" variant="subtle" className="hidden sm:inline-flex">
                <Link href="/check-in">
                  <Sparkles className="size-3.5 text-primary" />
                  Check in
                </Link>
              </Button>
              <ThemeToggle className="hidden sm:inline-flex" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full border border-border/70 bg-surface-2/50 py-1 pl-1 pr-2 transition-colors hover:border-primary/30"
                    aria-label="Open workspace menu"
                  >
                    <span className="flex size-7 items-center justify-center rounded-full bg-secondary/15 text-[10px] font-bold text-secondary">
                      {initials(profile.display_name)}
                    </span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="normal-case tracking-normal">
                    <span className="block text-xs font-semibold text-foreground">
                      {profile.display_name ?? "LOCKIN user"}
                    </span>
                    <span className="block truncate text-[10px] font-normal text-muted-foreground">
                      {email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings">
                      <Settings /> Settings
                    </Link>
                  </DropdownMenuItem>
                  <div className="px-2.5 py-2 sm:hidden">
                    <ThemeToggle />
                  </div>
                  <DropdownMenuSeparator />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main id="main-content" className="page-container">
          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="left-0 top-0 flex h-dvh w-[86%] max-w-[320px] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-y-0 border-l-0 p-0 sm:max-w-[320px]">
          <div className="flex h-16 items-center justify-between border-b border-border/60 px-4">
            <Wordmark />
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
          </div>
          <DialogTitle className="sr-only">Navigation</DialogTitle>
          <DialogDescription className="sr-only">Main sections of LOCKIN</DialogDescription>
          <div className="flex-1 overflow-y-auto px-2.5 py-5">
            <NavLinks
              groups={groups}
              pathname={pathname}
              collapsed={false}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
          <div className="border-t border-border/60 p-2.5">
            <UserCard
              profile={profile}
              email={email}
              collapsed={false}
              onNavigate={() => setDrawerOpen(false)}
            />
            <div className="mt-2 flex justify-center sm:hidden">
              <ThemeToggle />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mobile bottom navigation */}
      <nav
        className="no-print safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 px-2 pt-1.5 backdrop-blur-md lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-4">
          {MOBILE_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium text-muted-foreground"
          >
            <Menu className="size-5" />
            More
          </button>
        </div>
      </nav>
    </div>
  );
}
