"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { BallotPreview, Countdown, StateBadge, TallyPositions, TallyStats } from "@/components/election";
import { BallotBoxScene } from "@/components/ballot-box-scene";
import { ResultsWaitScene } from "@/components/results-wait-scene";
import { IconCheck, IconRefresh } from "@/components/icons";
import { Button, ErrorState, Skeleton } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { DashboardOut, ElectionOut, StudentProfileOut } from "@/lib/api/types";
import { formatWAT } from "@/lib/time";
import { Ballot } from "./ballot";

export const DASHBOARD_KEY = ["student", "dashboard"] as const;

/** Random 0–10 s delay so 2,000 dashboards don't all refetch in the same second. */
const jitter = () => Math.floor(Math.random() * 10_000);

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading your dashboard">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

function NoElection({ message, onCheck }: { message: string; onCheck: () => Promise<unknown> }) {
  const me = useQuery({ queryKey: ["student", "me"], queryFn: () => api<StudentProfileOut>("students/me"), staleTime: 300_000 });
  const [checking, setChecking] = useState(false);
  const firstName = me.data?.full_name.split(" ")[0];
  return (
    <section className="surface relative flex flex-col items-center overflow-hidden px-6 pb-10 pt-8 text-center sm:pt-10">
      <BallotBoxScene size={230} />
      <div className="stagger mt-4 flex flex-col items-center">
        {firstName && <p className="text-sm font-semibold text-primary">Hi {firstName},</p>}
        <h1 className="font-display mt-1 text-[28px] leading-tight sm:text-[32px]">No election right now</h1>
        <p className="mt-2 max-w-sm leading-relaxed text-muted">{message}</p>
        <p className="mt-1 max-w-sm text-sm text-muted">The ballot will appear here as soon as one is published.</p>
        <Button
          variant="secondary"
          className="mt-6"
          loading={checking}
          onClick={async () => {
            setChecking(true);
            await onCheck();
            setChecking(false);
          }}
        >
          <IconRefresh size={15} /> Check again
        </Button>
      </div>
    </section>
  );
}

function ElectionHeading({ election, children }: { election: ElectionOut; children?: ReactNode }) {
  return (
    <header className="mb-8">
      <div className="flex items-center gap-3">
        <StateBadge election={election} />
      </div>
      <h1 className="font-display mt-4 text-[34px] leading-[1.1] sm:text-[42px]">{election.title}</h1>
      {election.description && <p className="mt-3 max-w-xl leading-relaxed text-muted">{election.description}</p>}
      {children}
    </header>
  );
}

export function StudentDashboard() {
  const queryClient = useQueryClient();
  const [opening, setOpening] = useState(false);
  const { data, error, isPending, refetch } = useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: () => api<DashboardOut>("students/me/dashboard"),
    refetchInterval: (q) => {
      const state = q.state.data?.state;
      return state === "upcoming" || state === "ongoing" ? 60_000 : false;
    },
  });

  /** At a start/end boundary: wait a jittered moment, then refetch. */
  const onBoundary = () => {
    setOpening(true);
    setTimeout(async () => {
      await queryClient.invalidateQueries({ queryKey: DASHBOARD_KEY });
      setOpening(false);
    }, jitter());
  };

  if (isPending) return <DashboardSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const election = data.election;

  if (data.state === "no_election" || !election) {
    return <NoElection message={data.message} onCheck={() => refetch()} />;
  }

  if (data.state === "upcoming" && data.starts_at) {
    return (
      <>
        <ElectionHeading election={election} />
        <section className="surface p-6 sm:p-8">
          <Countdown to={data.starts_at} label="Voting opens in" onDone={onBoundary} />
          <p className="mt-6 border-t border-border pt-4 text-sm text-muted">
            {opening ? "Opening the ballot…" : data.message}
          </p>
        </section>
        <section className="mt-12">
          <h2 className="mb-4 text-sm font-bold">On the ballot</h2>
          <BallotPreview election={election} />
        </section>
      </>
    );
  }

  if (data.state === "ongoing") {
    return (
      <>
        <ElectionHeading election={election}>
          {data.ends_at && (
            <div className="mt-5">
              <Countdown compact to={data.ends_at} label="Polls close in" onDone={onBoundary} />
            </div>
          )}
        </ElectionHeading>
        <Ballot key={election.id} election={election} />
      </>
    );
  }

  if (data.state === "voted") {
    return (
      <>
        <ElectionHeading election={election} />
        <section className="surface relative overflow-hidden">
          <div className="flex items-start gap-4 px-6 pt-7 sm:px-8">
            <span className="relative flex size-11 shrink-0">
              <span className="animate-ripple absolute inset-0 rounded-full bg-primary" aria-hidden="true" />
              <span className="animate-pop relative flex size-11 items-center justify-center rounded-full bg-primary text-primary-fg">
                <IconCheck size={22} strokeWidth={2.5} />
              </span>
            </span>
            <div>
              <h2 className="font-display text-[26px] leading-tight">Your ballot is in.</h2>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{data.message}</p>
            </div>
          </div>

          {data.ends_at && data.starts_at && (
            <div className="stagger mt-6 flex flex-col items-center gap-6 border-t border-border px-6 pb-8 pt-8">
              <ResultsWaitScene startsAt={data.starts_at} endsAt={data.ends_at} onDone={onBoundary} />
              <div className="flex flex-col items-center text-center">
                <Countdown to={data.ends_at} label="Results in" />
                <p className="num mt-3 text-xs text-muted">
                  {opening ? "Counting the votes…" : `Polls close ${formatWAT(data.ends_at)}`}
                </p>
              </div>
            </div>
          )}
        </section>
      </>
    );
  }

  // ended
  return (
    <>
      <ElectionHeading election={election}>
        <p className="mt-4 text-sm text-muted">
          {election.status === "stopped" && election.stop_reason
            ? `Voting was stopped early: “${election.stop_reason}”.`
            : data.message}
        </p>
      </ElectionHeading>
      {data.results && (
        <div className="flex flex-col gap-6">
          <TallyStats tally={data.results} />
          <TallyPositions tally={data.results} final />
        </div>
      )}
    </>
  );
}
