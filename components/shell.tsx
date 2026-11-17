"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, logout } from "@/lib/api/client";
import type { SessionStateOut, StaffOut, StudentProfileOut } from "@/lib/api/types";
import { AuthShowcase, type ShowcaseKind } from "./auth-showcase";
import {
  IconActivity,
  IconArchive,
  IconBallot,
  IconCalendar,
  IconInbox,
  IconLogout,
  IconMenu,
  IconOverview,
  IconShield,
  IconUsers,
  IconX,
  Logo,
} from "./icons";
import { ThemeToggle } from "./theme";
import { Avatar } from "./ui";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  /** Match the href exactly (for section roots like /admin). */
  exact?: boolean;
  badge?: "unread";
}

const NAV: Record<"admin" | "super_admin", NavItem[]> = {
  admin: [
    { href: "/admin", label: "Overview", icon: IconOverview, exact: true },
    { href: "/admin/elections", label: "Elections", icon: IconBallot },
    { href: "/admin/archives", label: "Archives", icon: IconArchive },
    { href: "/admin/students", label: "Students", icon: IconUsers },
    { href: "/admin/messages", label: "Messages", icon: IconInbox, badge: "unread" },
  ],
  super_admin: [
    { href: "/super-admin", label: "Overview", icon: IconOverview, exact: true },
    { href: "/super-admin/elections", label: "Elections", icon: IconBallot },
    { href: "/super-admin/archives", label: "Archives", icon: IconArchive },
    { href: "/super-admin/session", label: "Session", icon: IconCalendar },
    { href: "/super-admin/admins", label: "Admins", icon: IconShield },
    { href: "/super-admin/students", label: "Students", icon: IconUsers },
    { href: "/super-admin/audit-logs", label: "Activity log", icon: IconActivity },
    { href: "/super-admin/messages", label: "Messages", icon: IconInbox },
  ],
};

export function Brand({ href = "/", compact }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
      <Logo size={30} />
      {!compact && <span className="text-[15px] font-extrabold tracking-[-0.02em]">Campus Voting</span>}
    </Link>
  );
}

function UnreadBadge() {
  const { data } = useQuery({
    queryKey: ["admin", "unread"],
    queryFn: () => api<{ unread: number }>("admin/messages/unread-count"),
    refetchInterval: 60_000,
  });
  if (!data?.unread) return null;
  return (
    <span className="num ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white" aria-label={`${data.unread} unread`}>
      {data.unread}
    </span>
  );
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold transition-colors",
              active ? "bg-primary-soft text-primary" : "text-muted hover:bg-subtle hover:text-foreground",
            )}
          >
            <Icon size={18} />
            {item.label}
            {item.badge === "unread" && <UnreadBadge />}
          </Link>
        );
      })}
    </>
  );
}

function StaffIdentity() {
  const { data } = useQuery({ queryKey: ["staff", "me"], queryFn: () => api<StaffOut>("auth/staff/me"), staleTime: 300_000 });
  const name = data?.full_name || data?.email || "";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar name={name || "·"} size={36} />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{name || " "}</p>
        <p className="truncate text-xs text-muted">{data ? (data.role === "super_admin" ? "Super admin" : "Admin") : " "}</p>
      </div>
    </div>
  );
}

function SessionChip({ href }: { href?: string }) {
  const { data } = useQuery({ queryKey: ["session"], queryFn: () => api<SessionStateOut>("admin/session"), staleTime: 300_000 });
  if (!data?.current) return null;
  const chip = (
    <span className="num rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary" title="Current academic session">
      {data.current}
    </span>
  );
  return href ? <Link href={href}>{chip}</Link> : chip;
}

function LogoutButton({ withLabel }: { withLabel?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="inline-flex h-9 items-center gap-2 rounded-full px-2.5 text-[13px] font-semibold text-muted transition-colors hover:bg-subtle hover:text-foreground"
      aria-label="Log out"
      title="Log out"
    >
      <IconLogout size={17} />
      {withLabel && "Log out"}
    </button>
  );
}

/** Sidebar layout for admins and the super admin. */
export function StaffShell({ role, children }: { role: "admin" | "super_admin"; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const items = NAV[role];
  const home = role === "admin" ? "/admin" : "/super-admin";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Main">
      <Suspense fallback={null}>
        <NavLinks items={items} onNavigate={() => setOpen(false)} />
      </Suspense>
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-1 gap-0 lg:gap-2 lg:p-4">
      <aside className="surface sticky top-4 hidden h-[calc(100vh-2rem)] w-64 shrink-0 flex-col p-4 lg:flex">
        <div className="px-2 pt-1">
          <Brand href={home} />
        </div>
        <div className="mb-2 mt-8 flex items-center justify-between gap-2 px-3.5">
          <p className="text-xs font-medium text-muted">{role === "admin" ? "Admin" : "Super admin"}</p>
          <SessionChip href={role === "super_admin" ? "/super-admin/session" : undefined} />
        </div>
        {nav}
        <div className="mt-auto flex flex-col gap-3">
          <ThemeToggle className="self-start" />
          <div className="flex items-center gap-1 rounded-2xl bg-subtle p-2.5">
            <StaffIdentity />
            <LogoutButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-background/85 px-4 backdrop-blur lg:hidden">
          <Brand href={home} />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex size-10 items-center justify-center rounded-full bg-card text-foreground shadow-sm"
          >
            {open ? <IconX size={18} /> : <IconMenu size={18} />}
          </button>
        </header>
        {open && (
          <div className="surface sticky top-16 z-20 mx-4 mb-2 p-3 lg:hidden">
            {nav}
            <div className="mt-3 flex items-center justify-between gap-3 px-3.5 py-1">
              <span className="text-sm font-semibold text-muted">Theme</span>
              <ThemeToggle withLabel />
            </div>
            <div className="mt-3 flex items-center gap-1 rounded-2xl bg-subtle p-2.5">
              <StaffIdentity />
              <LogoutButton withLabel />
            </div>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-6">{children}</main>
      </div>
    </div>
  );
}

function StudentIdentity() {
  const { data } = useQuery({
    queryKey: ["student", "me"],
    queryFn: () => api<StudentProfileOut>("students/me"),
    staleTime: 300_000,
  });
  if (!data) return null;
  return (
    <Link href="/student/profile" className="flex items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3 shadow-sm transition-colors hover:bg-subtle">
      <Avatar src={data.profile_picture_url} name={data.full_name} size={30} />
      <span className="hidden text-[13px] font-semibold sm:inline">{data.full_name.split(" ")[0]}</span>
    </Link>
  );
}

/** Top-bar layout for students (mobile-first). */
export function StudentShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <Brand href="/student" />
          <div className="flex items-center gap-1.5">
            <StudentIdentity />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-10 pt-4">{children}</main>
    </div>
  );
}

/** Split layout for public auth pages: mint showcase + form card. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  showcase,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  showcase: ShowcaseKind;
}) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="flex items-center justify-between">
          <Brand />
          <ThemeToggle />
        </div>
        <AuthShowcase kind={showcase} />
        <p className="text-center text-xs text-muted">Times shown in West Africa Time (WAT).</p>
      </aside>

      <div className="flex flex-col p-4 sm:p-6 lg:pl-0">
        <div className="mb-4 lg:hidden">
          <Brand />
        </div>
        <div className="surface flex flex-1 flex-col px-6 py-10 sm:px-12">
          <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
            <h1 className="text-[28px] font-extrabold tracking-[-0.03em]">{title}</h1>
            {subtitle && <div className="mt-1.5 text-sm leading-relaxed text-muted">{subtitle}</div>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 border-t border-border pt-5 text-sm text-muted">{footer}</div>}
          </div>
        </div>
        <ThemeToggle className="mt-4 flex justify-center lg:hidden" />
      </div>
    </div>
  );
}
