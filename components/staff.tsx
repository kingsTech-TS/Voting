"use client";

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
import type { ElectionOut, Page, StudentOut, TallyOut } from "@/lib/api/types";
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

export interface StudentFilters {
  page: number;
  search: string;
  level: string;
  registered: "" | "true" | "false";
}

const PAGE_SIZE = 50;

/** Shared by admin (with row actions) and super admin (read-only). */
export function StudentsTable({
  endpoint,
  actions,
  toolbar,
}: {
  endpoint: "admin/students" | "super-admin/students";
  actions?: (s: StudentOut) => ReactNode;
  toolbar?: ReactNode;
}) {
  const [filters, setFilters] = useState<StudentFilters>({ page: 1, search: "", level: "", registered: "" });
  const search = useDebounced(filters.search);
  const level = useDebounced(filters.level);

  const { data, error, isPending, refetch, isFetching } = useQuery({
    queryKey: ["students", endpoint, filters.page, search, level, filters.registered],
    queryFn: () =>
      api<Page<StudentOut>>(endpoint, {
        query: {
          page: filters.page,
          page_size: PAGE_SIZE,
          search: search.trim() || undefined,
          level: level.trim() || undefined,
          is_registered: filters.registered || undefined,
        },
      }),
    placeholderData: keepPreviousData,
  });

  const update = (patch: Partial<StudentFilters>) => setFilters((f) => ({ ...f, page: 1, ...patch }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            type="search"
            placeholder="Search name or Matric/Reg no."
            aria-label="Search students"
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="pl-9"
          />
        </div>
        <Input
          placeholder="Level (e.g. 300)"
          aria-label="Filter by level"
          value={filters.level}
          onChange={(e) => update({ level: e.target.value })}
          className="sm:w-40"
        />
        <Select
          aria-label="Filter by registration"
          value={filters.registered}
          onChange={(e) => update({ registered: e.target.value as StudentFilters["registered"] })}
          className="sm:w-48"
        >
          <option value="">All students</option>
          <option value="true">Registered</option>
          <option value="false">Not registered</option>
        </Select>
        <div className="flex gap-2 sm:ml-auto">{toolbar}</div>
      </div>

      {isPending ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No students found">
          {filters.search || filters.level || filters.registered ? "Try different filters." : "Students added by an admin will appear here."}
        </EmptyState>
      ) : (
        <div className={isFetching ? "opacity-70 transition-opacity" : undefined}>
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Matric / Reg no.</Th>
                <Th>Level</Th>
                <Th>Status</Th>
                <Th>Added</Th>
                {actions && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar src={s.profile_picture_url} name={s.full_name} size={32} />
                      <span className="font-medium">{s.full_name}</span>
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
          <TallyPositions tally={tally} final={tally.state === "ended"} />
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
