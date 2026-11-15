"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Countdown, ElectionTimes, StateBadge } from "@/components/election";
import { Donut, LegendStat } from "@/components/charts";
import { IconArrowRight, IconBallot } from "@/components/icons";
import { EmptyState, Skeleton, buttonClass } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { ElectionOut, Page, StudentOut } from "@/lib/api/types";

export function StatCard({
  label,
  value,
  href,
  note,
  icon,
}: {
  label: string;
  value: string | number | undefined;
  href?: string;
  note?: string;
  icon?: ReactNode;
}) {
  const body = (
    <div className="surface group flex h-full flex-col p-5 transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted">{label}</p>
        {icon && <span className="flex size-9 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</span>}
      </div>
      {value === undefined ? (
        <Skeleton className="mt-3 h-9 w-16" />
      ) : (
        <p className="num mt-2 text-[34px] font-extrabold leading-none tracking-tight">{typeof value === "number" ? value.toLocaleString() : value}</p>
      )}
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Total and registered student counts via `total` on a 1-row page. */
export function useStudentCounts(endpoint: "admin/students" | "super-admin/students") {
  const total = useQuery({
    queryKey: ["students", endpoint, "count", "all"],
    queryFn: () => api<Page<StudentOut>>(endpoint, { query: { page_size: 1 } }),
  });
  const registered = useQuery({
    queryKey: ["students", endpoint, "count", "registered"],
    queryFn: () => api<Page<StudentOut>>(endpoint, { query: { page_size: 1, is_registered: true } }),
  });
  return { total: total.data?.total, registered: registered.data?.total };
}

/** Registered vs not-yet-registered students as a part-of-whole donut (reference "Gender" card). */
export function RegistrationCard({ total, registered, href }: { total?: number; registered?: number; href?: string }) {
  const loading = total === undefined || registered === undefined;
  const pending = loading ? 0 : Math.max(total - registered, 0);
  const pct = !loading && total ? Math.round((registered / total) * 100) : 0;
  return (
    <section className="surface flex flex-col p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold tracking-tight">Registration</h2>
        {href && (
          <Link href={href} className="text-xs font-semibold text-primary hover:underline">
            View students
          </Link>
        )}
      </div>
      <p className="mt-3 text-xs font-semibold">Students</p>
      {loading ? (
        <Skeleton className="mx-auto mt-4 size-40 rounded-full" />
      ) : (
        <div className="mt-3 flex items-center justify-between gap-3">
          <LegendStat color="var(--series-track)" label="Not registered" value={pending.toLocaleString()} />
          <Donut
            segments={[{ key: "reg", label: "Registered", value: registered, color: "var(--series-1)" }]}
            total={total}
            size={160}
            thickness={18}
            label={`${registered} of ${total} students registered`}
            center={() => (
              <>
                <span className="num text-[30px] font-extrabold leading-none tracking-tight">{pct}%</span>
                <span className="mt-1 text-xs text-muted">registered</span>
              </>
            )}
          />
          <LegendStat color="var(--series-1)" label="Registered" value={registered.toLocaleString()} align="right" />
        </div>
      )}
    </section>
  );
}

/** The most relevant election: ongoing, else upcoming, else the latest one. */
export function CurrentElectionCard({ basePath }: { basePath: "/admin/elections" | "/super-admin/elections" }) {
  const isAdmin = basePath === "/admin/elections";
  const { data, isPending } = useQuery({
    queryKey: ["elections", "overview"],
    queryFn: () => api<Page<ElectionOut>>("admin/elections", { query: { page_size: 20 } }),
  });
  if (isPending) return <Skeleton className="h-64 w-full rounded-3xl" />;
  const items = data?.items ?? [];
  const election = items.find((e) => e.state === "ongoing") ?? items.find((e) => e.state === "upcoming") ?? items[0];
  if (!election) {
    return (
      <EmptyState
        icon={<IconBallot size={20} />}
        title="No elections yet"
        action={
          isAdmin ? (
            <Link href="/admin/elections/new" className={buttonClass("primary")}>
              Create an election
            </Link>
          ) : undefined
        }
      >
        {isAdmin ? "Set up positions and candidates, then publish when it's ready." : "Admins haven't created any elections yet."}
      </EmptyState>
    );
  }
  const live = election.state === "ongoing" || election.state === "ended";
  const candidates = election.positions.reduce((n, p) => n + p.candidates.length, 0);
  return (
    <section className="surface flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">Current election</h2>
        <StateBadge election={election} />
      </div>
      <p className="mt-4 text-2xl font-extrabold tracking-tight">{election.title}</p>
      <p className="mt-1 text-sm text-muted">
        <span className="num">{election.positions.length}</span> positions · <span className="num">{candidates}</span> candidates
      </p>
      <div className="mt-5">
        <ElectionTimes election={election} />
      </div>
      {(election.state === "upcoming" || election.state === "ongoing") && (
        <div className="mt-6">
          <Countdown to={election.state === "upcoming" ? election.start_time : election.end_time} label={election.state === "upcoming" ? "Opens in" : "Closes in"} />
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        <Link href={`${basePath}/${election.id}`} className={buttonClass("secondary", "md")}>
          {isAdmin ? "Open builder" : "View election"}
        </Link>
        {isAdmin && live && (
          <Link href={`${basePath}/${election.id}/live`} className={buttonClass("primary", "md")}>
            {election.state === "ongoing" ? "Watch live count" : "See results"}
            <IconArrowRight size={14} />
          </Link>
        )}
      </div>
    </section>
  );
}
