"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { Badge, Button, EmptyState, ErrorState, Input, PageHeader, PageSpinner, Select, Table, Td, Th } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { AuditLogOut, CursorPage } from "@/lib/api/types";
import { formatWAT, toAwareISO } from "@/lib/time";
import { useAllAdmins } from "../use-admins";

const ACTIONS = [
  "auth.login",
  "auth.login_failed",
  "admin.onboarded",
  "admin.create",
  "admin.suspend",
  "admin.unsuspend",
  "admin.reset_password",
  "admin.delete",
  "student.create",
  "student.bulk_import",
  "student.update",
  "student.delete",
  "student.reset_registration",
  "election.create",
  "election.update",
  "election.delete",
  "election.publish",
  "election.unpublish",
  "election.stop",
  "position.add",
  "position.rename",
  "position.remove",
  "candidate.add",
  "candidate.remove",
  "message.send",
];

function actionTone(action: string): "danger" | "warning" | "success" | "info" | "neutral" {
  if (action.endsWith("login_failed") || action.endsWith("delete") || action.endsWith("suspend") || action === "election.stop") return "danger";
  if (action.endsWith("reset_password") || action.endsWith("reset_registration") || action.endsWith("unpublish")) return "warning";
  if (action.endsWith("publish") || action.endsWith("create") || action.endsWith("add")) return "success";
  if (action.startsWith("auth.")) return "info";
  return "neutral";
}

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

  return (
    <>
      <PageHeader title="Activity logs" description="Every login and change made by staff. Times are WAT." />
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Select aria-label="Filter by admin" value={filters.actor_id} onChange={set("actor_id")}>
          <option value="">All staff</option>
          {admins.data?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name ? `${a.full_name} (${a.email})` : a.email}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by action" value={filters.action} onChange={set("action")}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
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
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>IP</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {items.map((log) => {
              const hasMeta = Object.keys(log.metadata).length > 0;
              return (
                <Fragment key={log.id}>
                  <tr>
                    <Td className="whitespace-nowrap text-muted">{formatWAT(log.created_at)}</Td>
                    <Td>
                      <p className="font-medium">{log.actor_email ?? "—"}</p>
                      <p className="text-xs text-muted">{log.actor_role === "super_admin" ? "Super admin" : log.actor_role === "admin" ? "Admin" : log.actor_role}</p>
                    </Td>
                    <Td>
                      <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                    </Td>
                    <Td className="text-xs text-muted">
                      {log.target_type ? (
                        <>
                          {log.target_type}
                          {log.target_id && <span className="block font-mono">{log.target_id}</span>}
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="font-mono text-xs text-muted">{log.ip ?? "—"}</Td>
                    <Td className="text-right">
                      {hasMeta && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-expanded={expanded === log.id}
                          onClick={() => setExpanded((e) => (e === log.id ? null : log.id))}
                        >
                          {expanded === log.id ? "Hide" : "Details"}
                        </Button>
                      )}
                    </Td>
                  </tr>
                  {expanded === log.id && (
                    <tr>
                      <Td colSpan={6} className="bg-subtle">
                        <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs">{JSON.stringify(log.metadata, null, 2)}</pre>
                      </Td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </Table>
      )}
      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => void fetchNextPage()} loading={isFetchingNextPage}>
            Load older activity
          </Button>
        </div>
      )}
    </>
  );
}
