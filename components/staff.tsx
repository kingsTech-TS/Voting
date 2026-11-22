"use client";

import clsx from "clsx";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { StateBadge, TallyPositions, TallyStats, TallyUpdated } from "@/components/election";
import { IconCheck, IconSearch, IconX } from "@/components/icons";
import { Alert, Avatar, Badge, Button, EmptyState, ErrorState, Input, PageSpinner, Pagination, Select, Table, Td, Th } from "@/components/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useLiveTally, type LiveStatus } from "@/lib/api/use-live-tally";
import type { ElectionOut, Page, SessionStateOut, StudentOut, TallyOut } from "@/lib/api/types";
import { formatDate, formatWAT } from "@/lib/time";

export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

// ---- students table -------------------------------------------------------------------------------

export type StudentSort = "name_asc" | "name_desc" | "level" | "newest" | "oldest";

export interface StudentFilters {
  page: number;
  search: string;
  level: string;
  registered: "" | "true" | "false";
  paid: "" | "true" | "false";
  sort: StudentSort;
}

const PAGE_SIZE = 100;
const EMPTY_FILTERS: StudentFilters = { page: 1, search: "", level: "", registered: "", paid: "", sort: "name_asc" };

const PAYMENT: { value: StudentFilters["paid"]; label: string }[] = [
  { value: "", label: "Any payment" },
  { value: "true", label: "Paid" },
  { value: "false", label: "Not paid" },
];

const SORTS: { value: StudentSort; label: string }[] = [
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
  { value: "level", label: "Level" },
  { value: "newest", label: "Newest added" },
  { value: "oldest", label: "Oldest added" },
];

const REGISTRATION: { value: StudentFilters["registered"]; label: string }[] = [
  { value: "", label: "All" },
  { value: "true", label: "Registered" },
  { value: "false", label: "Not registered" },
];

/** Shared by admin (with row actions) and super admin (read-only). */
export function StudentsTable({
  endpoint,
  actions,
  toolbar,
  bulkActions,
  rowState,
}: {
  endpoint: "admin/students" | "super-admin/students";
  /** Animates a row: "new" just added (slides in), "leaving" just deleted (slides out). */
  rowState?: (s: StudentOut) => "new" | "leaving" | undefined;
  actions?: (s: StudentOut) => ReactNode;
  toolbar?: ReactNode;
  /** Enables tick boxes; renders the bar shown while students are selected. */
  bulkActions?: (selected: StudentOut[], clear: () => void) => ReactNode;
}) {
  const [filters, setFilters] = useState<StudentFilters>(EMPTY_FILTERS);
  const session = useQuery({ queryKey: ["session"], queryFn: () => api<SessionStateOut>("admin/session"), staleTime: 60_000 });
  const levelOptions = [...(session.data?.levels ?? []), ...(session.data?.other_levels ?? [])];
  const [selected, setSelected] = useState<Map<string, StudentOut>>(new Map());
  const clearSelection = () => setSelected(new Map());
  const toggle = (s: StudentOut) =>
    setSelected((m) => {
      const next = new Map(m);
      if (next.has(s.id)) next.delete(s.id);
      else next.set(s.id, s);
      return next;
    });
  const search = useDebounced(filters.search);
  const level = filters.level;

  const { data, error, isPending, refetch, isFetching } = useQuery({
    queryKey: ["students", endpoint, filters.page, search, level, filters.registered, filters.paid, filters.sort],
    queryFn: () =>
      api<Page<StudentOut>>(endpoint, {
        query: {
          page: filters.page,
          page_size: PAGE_SIZE,
          search: search.trim() || undefined,
          level: level.trim() || undefined,
          is_registered: filters.registered || undefined,
          paid: filters.paid || undefined,
          sort: filters.sort,
        },
      }),
    placeholderData: keepPreviousData,
  });

  const update = (patch: Partial<StudentFilters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));
  const filtered = Boolean(filters.search || filters.level || filters.registered || filters.paid || filters.sort !== "name_asc");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative lg:w-72">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            placeholder="Search name, Matric/Reg no. or email"
            aria-label="Search students"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select aria-label="Sort students" value={filters.sort} onChange={(e) => update({ sort: e.target.value as StudentSort })} className="sm:w-40">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by level" value={filters.level} onChange={(e) => update({ level: e.target.value })} className="sm:w-40">
            <option value="">All levels</option>
            {levelOptions.map((l) => (
              <option key={l.level} value={l.level}>
                {/^\d+$/.test(l.level) ? `${l.level} level` : l.level} ({l.count.toLocaleString()})
              </option>
            ))}
          </Select>
        </div>
        <div className="flex gap-2 lg:ml-auto">{toolbar}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-card p-1 text-[13px] font-semibold shadow-[var(--shadow-card)] ring-1 ring-card-border" role="radiogroup" aria-label="Registration status">
          {REGISTRATION.map((r) => {
            const on = filters.registered === r.value;
            return (
              <button
                key={r.label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update({ registered: r.value })}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  on ? "bg-primary text-primary-fg" : "text-muted hover:bg-subtle hover:text-foreground",
                )}
              >
                {r.value === "true" && <span className={clsx("size-1.5 rounded-full", on ? "bg-primary-fg" : "bg-primary")} aria-hidden="true" />}
                {r.value === "false" && <span className={clsx("size-1.5 rounded-full", on ? "bg-primary-fg" : "bg-danger")} aria-hidden="true" />}
                {r.label}
              </button>
            );
          })}
        </div>
        <div className="flex rounded-xl bg-card p-1 text-[13px] font-semibold shadow-[var(--shadow-card)] ring-1 ring-card-border" role="radiogroup" aria-label="Payment status">
          {PAYMENT.map((r) => {
            const on = filters.paid === r.value;
            return (
              <button
                key={r.label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => update({ paid: r.value })}
                className={clsx(
                  "rounded-lg px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                  on ? "bg-ink text-ink-fg" : "text-muted hover:bg-subtle hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        {data && (
          <p className="num text-[13px] text-muted">
            <span className="font-bold text-foreground">{data.total.toLocaleString()}</span> student{data.total === 1 ? "" : "s"}
            {filters.level && <> in {/^\d+$/.test(filters.level) ? `${filters.level} level` : filters.level}</>}
          </p>
        )}
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        )}
      </div>

      {bulkActions && selected.size > 0 && (
        <div className="animate-fade-in surface sticky top-20 z-20 flex flex-wrap items-center justify-between gap-3 !rounded-2xl px-4 py-3 lg:top-4">
          <p className="text-sm">
            <span className="num font-extrabold">{selected.size.toLocaleString()}</span> selected
            <button type="button" onClick={clearSelection} className="ml-3 text-[13px] font-semibold text-muted hover:text-foreground">
              Clear
            </button>
          </p>
          <div className="flex gap-2">{bulkActions([...selected.values()], clearSelection)}</div>
        </div>
      )}

      {isPending ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No students found">
          {filtered ? "Try different filters." : "Students added by an admin will appear here."}
        </EmptyState>
      ) : (
        <div className={isFetching ? "opacity-70 transition-opacity" : undefined}>
          <Table>
            <thead>
              <tr>
                {bulkActions && (
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all students on this page"
                      className="size-4 accent-[var(--primary)]"
                      checked={data.items.length > 0 && data.items.every((s) => selected.has(s.id))}
                      onChange={(e) =>
                        setSelected((m) => {
                          const next = new Map(m);
                          for (const s of data.items) {
                            if (e.target.checked) next.set(s.id, s);
                            else next.delete(s.id);
                          }
                          return next;
                        })
                      }
                    />
                  </Th>
                )}
                <Th>Student</Th>
                <Th>Matric / Reg no.</Th>
                <Th>Level</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th>Added</Th>
                {actions && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr
                  key={s.id}
                  className={clsx(
                    selected.has(s.id) && "bg-primary-soft/50",
                    rowState?.(s) === "new" && "animate-row-in",
                    rowState?.(s) === "leaving" && "animate-row-out",
                  )}
                >
                  {bulkActions && (
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.full_name}`}
                        className="size-4 accent-[var(--primary)]"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s)}
                      />
                    </Td>
                  )}
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar src={s.profile_picture_url} name={s.full_name} size={32} />
                      <span className="min-w-0">
                        <span className="block font-medium">{s.full_name}</span>
                        {s.email ? (
                          <span className="block truncate text-xs text-muted">{s.email}</span>
                        ) : (
                          !s.is_registered && (
                            <span className="block text-xs font-medium text-warning" title="Add an email so this student can register">
                              No email · can&apos;t register
                            </span>
                          )
                        )}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs">{s.identifier}</span>
                    <span className="ml-2 text-xs text-muted">{s.id_type === "matric" ? "Matric" : "Reg"}</span>
                  </Td>
                  <Td>{s.level}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
                      <span
                        className={s.is_registered ? "flex size-5 items-center justify-center rounded-full bg-primary text-primary-fg" : "flex size-5 items-center justify-center rounded-full bg-danger-soft text-danger"}
                        aria-hidden="true"
                      >
                        {s.is_registered ? <IconCheck size={11} strokeWidth={3} /> : <IconX size={11} strokeWidth={3} />}
                      </span>
                      <span className={s.is_registered ? undefined : "text-muted"}>{s.is_registered ? "Registered" : "Not registered"}</span>
                    </span>
                  </Td>
                  <Td>
                    {s.paid ? (
                      <Badge tone="success" className="gap-1">
                        <IconCheck size={11} strokeWidth={3} /> Paid
                      </Badge>
                    ) : (
                      <Badge tone="neutral">Not paid</Badge>
                    )}
                  </Td>
                  <Td className="text-muted">{formatDate(s.created_at)}</Td>
                  {actions && <Td className="text-right">{actions(s)}</Td>}
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={filters.page} pageSize={PAGE_SIZE} total={data.total} onPage={(page) => setFilters((f) => ({ ...f, page }))} />
        </div>
      )}
    </div>
  );
}

// ---- elections list -------------------------------------------------------------------------------

export function ElectionsTable({ basePath }: { basePath: "/admin/elections" | "/super-admin/elections" }) {
  const [status, setStatus] = useState<"" | "draft" | "published" | "stopped">("");
  const [page, setPage] = useState(1);
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["elections", status, page],
    queryFn: () => api<Page<ElectionOut>>("admin/elections", { query: { status: status || undefined, page, page_size: 20 } }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-4">
      <Select
        aria-label="Filter by status"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value as typeof status);
          setPage(1);
        }}
        className="sm:w-48"
      >
        <option value="">All elections</option>
        <option value="draft">Drafts</option>
        <option value="published">Published</option>
        <option value="stopped">Stopped</option>
      </Select>
      {isPending ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No elections yet">
          {basePath === "/admin/elections" ? "Create an election to get started." : "Admins have not created any elections yet."}
        </EmptyState>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>State</Th>
                <Th>Starts</Th>
                <Th>Ends</Th>
                <Th>Positions</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id} className="hover:bg-subtle">
                  <Td>
                    <Link href={`${basePath}/${e.id}`} className="font-medium underline-offset-4 hover:underline">
                      {e.title}
                    </Link>
                  </Td>
                  <Td>
                    <StateBadge election={e} />
                  </Td>
                  <Td className="text-muted">{formatWAT(e.start_time)}</Td>
                  <Td className="text-muted">{formatWAT(e.end_time)}</Td>
                  <Td>{e.positions.length}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={20} total={data.total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

// ---- live view ------------------------------------------------------------------------------------

const STATUS_LABEL: Record<LiveStatus, { label: string; tone: "success" | "warning" | "neutral" | "info" }> = {
  connecting: { label: "Connecting…", tone: "neutral" },
  live: { label: "Live", tone: "success" },
  reconnecting: { label: "Reconnecting…", tone: "warning" },
  polling: { label: "Polling every 5 s", tone: "warning" },
  ended: { label: "Final results", tone: "info" },
};

/** Live tally for an ongoing election; final results once ended. Shared by admin and super admin. */
export function LiveTally({ election, onEnded }: { election: ElectionOut; onEnded?: () => void }) {
  const live = election.state === "ongoing" || election.state === "ended";
  const { tally, status, setTally } = useLiveTally(election.id, live);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (status === "ended") onEnded?.();
  }, [status, onEnded]);

  if (!live) {
    return (
      <Alert tone="info" title="No votes yet">
        The live count starts when voting opens on {formatWAT(election.start_time)}.
      </Alert>
    );
  }

  const refreshFromDb = async () => {
    setRefreshing(true);
    try {
      setTally(await api<TallyOut>(`admin/elections/${election.id}/tally`));
      toast.success("Counted from the database.");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  const s = STATUS_LABEL[status];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge tone={s.tone} dot={status === "live" ? "pulse" : true}>
            {s.label}
          </Badge>
          {tally && <TallyUpdated tally={tally} />}
        </div>
        <Button variant="secondary" size="sm" onClick={refreshFromDb} loading={refreshing}>
          Refresh from database
        </Button>
      </div>
      {tally ? (
        <>
          <TallyStats tally={tally} />
          <TallyPositions tally={tally} final={tally.state === "ended"} electionId={election.id} />
        </>
      ) : (
        <PageSpinner label="Connecting to the live count…" />
      )}
    </div>
  );
}

export function useElection(id: string) {
  return useQuery({
    queryKey: ["election", id],
    queryFn: () => api<ElectionOut>(`admin/elections/${id}`),
    refetchInterval: (q) => (q.state.data?.state === "upcoming" || q.state.data?.state === "ongoing" ? 30_000 : false),
  });
}
