"use client";

import { useCallback } from "react";
import { ShareResultsCard } from "@/components/archives";
import { ElectionTimes, StateBadge } from "@/components/election";
import { LiveTally, useElection } from "@/components/staff";
import { BackLink, ErrorState, PageSpinner } from "@/components/ui";

export function AdminLive({ id }: { id: string }) {
  const { data: election, error, isPending, refetch } = useElection(id);
  const onEnded = useCallback(() => void refetch(), [refetch]);

  if (isPending) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href={`/admin/elections/${id}`}>{election.title}</BackLink>
        <StateBadge election={election} />
        <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em]">
          {election.state === "ended" ? "Results" : "Live count"}
        </h1>
        <div className="mt-4">
          <ElectionTimes election={election} />
        </div>
      </div>
      {election.state === "ended" && <ShareResultsCard election={election} />}
      <LiveTally election={election} onEnded={onEnded} />
    </div>
  );
}
