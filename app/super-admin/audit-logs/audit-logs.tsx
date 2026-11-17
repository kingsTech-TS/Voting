"use client";

import clsx from "clsx";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { IconChevronDown } from "@/components/icons";
import { Avatar, Badge, Button, EmptyState, ErrorState, Input, PageHeader, PageSpinner, Select } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { AuditLogOut, CursorPage, StaffOut } from "@/lib/api/types";
import {
  ACTIONS,
  CATEGORY_ORDER,
  actionInfo,
  describeDevice,
  detailFields,
  parseLoggedDate,
  roleLabel,
  type AuditTone,
  type DetailField,
} from "@/lib/audit";
import { formatClock, formatDate, formatWAT, toAwareISO } from "@/lib/time";
import { useAllAdmins } from "../use-admins";

const TONE_DOT: Record<AuditTone, string> = {
  danger: "bg-danger ring-danger-soft",
  warning: "bg-warning ring-warning-soft",
  success: "bg-primary ring-primary-soft",
  info: "bg-info ring-info-soft",
  neutral: "bg-border-strong ring-subtle",
};

export function AuditLogs() {
  const admins = useAllAdmins();
  const [filters, setFilters] = useState({ actor_id: "", action: "", from: "", to: "" });
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, error, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["audit-logs", filters],
    queryFn: ({ pageParam }) =>
      api<CursorPage<AuditLogOut>>("super-admin/audit-logs", {
        query: {
          actor_id: filters.actor_id || undefined,
          action: filters.action || undefined,
          date_from: filters.from ? toAwareISO(`${filters.from}T00:00`) : undefined,
          date_to: filters.to ? toAwareISO(`${filters.to}T23:59:59`) : undefined,
          before: pageParam,
          limit: 50,
        },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const set = (key: keyof typeof filters) => (e: { target: { value: string } }) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const hasFilters = Object.values(filters).some(Boolean);
  const staffById = new Map((admins.data ?? []).map((a) => [a.id, a]));

  // Group consecutive entries by WAT calendar day.
  const days: { day: string; logs: AuditLogOut[] }[] = [];
  for (const log of items) {
    const day = formatDate(log.created_at);
    const last = days[days.length - 1];
    if (last?.day === day) last.logs.push(log);
    else days.push({ day, logs: [log] });
  }

  return (
    <>
      <PageHeader title="Activity log" description="Every sign-in and change made by staff, newest first. Times are WAT." />
      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <Select aria-label="Filter by staff member" value={filters.actor_id} onChange={set("actor_id")}>
          <option value="">All staff</option>
          {admins.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name ? `${a.full_name} (${a.email})` : a.email}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by activity" value={filters.action} onChange={set("action")}>
          <option value="">All activity</option>
          {CATEGORY_ORDER.map((cat) => (
            <optgroup key={cat} label={cat}>
              {Object.entries(ACTIONS)
                .filter(([, info]) => info.category === cat)
                .map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
        <Input type="date" aria-label="From date" value={filters.from} onChange={set("from")} />
        <Input type="date" aria-label="To date" value={filters.to} onChange={set("to")} />
        {hasFilters && (
          <Button variant="ghost" onClick={() => setFilters({ actor_id: "", action: "", from: "", to: "" })}>
            Clear filters
          </Button>
        )}
      </div>

      {isPending ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No activity found">{hasFilters ? "Try different filters." : undefined}</EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map(({ day, logs }) => (
            <section key={day}>
              <h2 className="mb-2 flex items-center gap-3 px-1 text-xs font-semibold text-muted">
                {day}
                <span className="h-px flex-1 bg-border" />
                <span className="num font-medium">
                  {logs.length} {logs.length === 1 ? "event" : "events"}
                </span>
              </h2>
              <ol className="surface flex flex-col gap-0.5 p-1.5">
                {logs.map((log) => (
                  <LogEntry
                    key={log.id}
                    log={log}
                    staff={log.actor_id ? staffById.get(log.actor_id) : undefined}
                    open={expanded === log.id}
                    onToggle={() => setExpanded((e) => (e === log.id ? null : log.id))}
                  />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={() => void fetchNextPage()} loading={isFetchingNextPage}>
            Load older activity
          </Button>
        </div>
      )}
    </>
  );
}

function LogEntry({ log, staff, open, onToggle }: { log: AuditLogOut; staff?: StaffOut; open: boolean; onToggle: () => void }) {
  const info = actionInfo(log.action);
  const actorName = staff?.full_name || log.actor_email || (log.actor_role ? "Unknown" : "System");
  const detailsId = `log-${log.id}`;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={detailsId}
        className={clsx(
          "flex w-full items-start gap-3.5 rounded-2xl px-3.5 py-3 text-left transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:outline-primary",
          open && "bg-subtle",
        )}
      >
        <span className={clsx("mt-1.5 size-2.5 shrink-0 rounded-full ring-4", TONE_DOT[info.tone])} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-relaxed">
            <span className="font-bold">{actorName}</span>{" "}
            <span className="text-foreground/85">{lowerFirst(info.describe(log.metadata))}</span>
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <Badge tone={info.tone}>{info.label}</Badge>
            <span>{roleLabel(log.actor_role)}</span>
            {log.ip && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{log.ip}</span>
              </>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          <span className="num text-xs font-medium text-muted">{formatClock(log.created_at).slice(0, 5)}</span>
          <IconChevronDown size={16} className={clsx("text-muted transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && <LogDetails id={detailsId} log={log} staff={staff} />}
    </li>
  );
}

/** "Signed in…" reads as "Ada signed in…". */
function lowerFirst(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

function LogDetails({ id, log, staff }: { id: string; log: AuditLogOut; staff?: StaffOut }) {
  const info = actionInfo(log.action);
  const fields = detailFields(log.metadata);
  const device = describeDevice(log.user_agent);
  const name = staff?.full_name || log.actor_email || (log.actor_role ? "Unknown" : "System");
  const target =
    log.target_type === "election" && log.target_id ? (
      <Link href={`/super-admin/elections/${log.target_id}`} className="font-semibold text-primary hover:underline">
        Open election
      </Link>
    ) : log.target_type === "user" ? (
      "Staff account"
    ) : log.target_type === "student" ? (
      "Student record"
    ) : log.target_type ? (
      log.target_type.charAt(0).toUpperCase() + log.target_type.slice(1)
    ) : null;

  return (
    <div
      id={id}
      className="animate-fade-in mx-1.5 mb-2 mt-1 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:p-5"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted">What happened</p>
        <p className="mt-1 text-sm font-semibold">{info.describe(log.metadata)}</p>
        {fields.length > 0 ? (
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={clsx("rounded-xl bg-subtle px-3 py-2.5", (f.kind === "long" || f.kind === "list") && "sm:col-span-2")}>
                <dt className="text-[11px] font-medium text-muted">{f.label}</dt>
                <dd className="mt-0.5 break-words text-[13px] font-semibold">
                  <FieldValue field={f} />
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted">No extra details were recorded for this event.</p>
        )}
      </div>
      <div className="min-w-0 rounded-xl bg-subtle p-3.5">
        <p className="text-xs font-semibold text-muted">Context</p>
        <div className="mt-2.5 flex items-center gap-2.5">
          <Avatar name={name} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{name}</p>
            <p className="truncate text-xs text-muted">
              {roleLabel(log.actor_role)}
              {staff?.full_name && log.actor_email ? ` · ${log.actor_email}` : ""}
            </p>
          </div>
        </div>
        <dl className="mt-3 flex flex-col gap-2 text-[13px]">
          <ContextRow label="When">
            <span className="num">
              {formatDate(log.created_at)} · {formatClock(log.created_at)} WAT
            </span>
          </ContextRow>
          {target && <ContextRow label="Affects">{target}</ContextRow>}
          <ContextRow label="IP address">
            <span className="font-mono text-xs">{log.ip ?? "—"}</span>
          </ContextRow>
          {device && (
            <ContextRow label="Device">
              <span title={log.user_agent ?? undefined}>{device}</span>
            </ContextRow>
          )}
          {log.target_id && (
            <ContextRow label="Record ID">
              <span className="font-mono text-[11px] text-muted">{log.target_id}</span>
            </ContextRow>
          )}
        </dl>
      </div>
    </div>
  );
}

function ContextRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  );
}

function FieldValue({ field }: { field: DetailField }) {
  const v = field.value;
  switch (field.kind) {
    case "date": {
      const iso = parseLoggedDate(v);
      return <span className="num">{iso ? formatWAT(iso) : String(v)}</span>;
    }
    case "bool":
      return <span className={v ? "text-primary" : "text-muted"}>{v ? "Yes" : "No"}</span>;
    case "number":
      return <span className="num">{(v as number).toLocaleString()}</span>;
    case "id":
      return <span className="font-mono text-[11px] font-medium text-muted">{String(v)}</span>;
    case "list":
      return <span>{(v as unknown[]).map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")}</span>;
    case "long":
      return <span className="font-normal leading-relaxed">“{String(v)}”</span>;
    default:
      return <span>{typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}</span>;
  }
}
