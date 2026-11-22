"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ShareResultsCard } from "@/components/archives";
import { BallotPreview, Countdown, ElectionTimes, StateBadge } from "@/components/election";
import { LiveTally, useElection } from "@/components/staff";
import { Alert, BackLink, Button, Dialog, ErrorState, PageSpinner, TextAreaField, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { ElectionOut } from "@/lib/api/types";
import { check, stopReasonSchema } from "@/lib/validation";
import { focusFirstError } from "@/lib/focus-error";

export function SuperAdminElection({ id }: { id: string }) {
  const { data: election, error, isPending, refetch } = useElection(id);
  const [stopping, setStopping] = useState(false);
  const onEnded = useCallback(() => void refetch(), [refetch]);

  if (isPending) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/super-admin/elections">Elections</BackLink>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <StateBadge election={election} />
            <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em]">{election.title}</h1>
            {election.description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{election.description}</p>}
            <div className="mt-4">
              <ElectionTimes election={election} />
            </div>
          </div>
          {election.state === "ongoing" && (
            <Button variant="danger" onClick={() => setStopping(true)}>
              Stop election
            </Button>
          )}
        </div>
      </div>

      {election.state === "draft" && <Alert tone="info">This election is a draft. Admins are still preparing it.</Alert>}
      {election.state === "upcoming" && (
        <Countdown to={election.start_time} label="Voting opens in" onDone={() => setTimeout(() => void refetch(), 1500)} />
      )}
      {(election.state === "draft" || election.state === "upcoming") && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Ballot</h2>
          {election.positions.length ? <BallotPreview election={election} /> : <p className="text-sm text-muted">No positions yet.</p>}
        </section>
      )}
      {election.state === "ended" && <ShareResultsCard election={election} />}
      {(election.state === "ongoing" || election.state === "ended") && <LiveTally election={election} onEnded={onEnded} />}

      {stopping && <StopDialog election={election} onClose={() => setStopping(false)} />}
    </div>
  );
}

function StopDialog({ election, onClose }: { election: ElectionOut; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const matches = typed.trim() === election.title.trim();

  const stop = async () => {
    const result = check(stopReasonSchema, { reason });
    setError(result.errors?.reason ?? null);
    if (!result.data || !matches) return focusFirstError();
    setLoading(true);
    try {
      const updated = await api<ElectionOut>(`super-admin/elections/${election.id}/stop`, { json: { reason: result.data.reason } });
      queryClient.setQueryData(["election", election.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["elections"] });
      toast.success("Election stopped. Students can now see the results.");
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
      void queryClient.invalidateQueries({ queryKey: ["election", election.id] });
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!loading}
      title="Stop this election?"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={stop} loading={loading} disabled={!matches}>
            Stop election now
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="danger">
          Voting ends immediately and cannot be reopened. Only votes cast before now are counted, and students will see the results.
        </Alert>
        <TextAreaField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} error={error} maxLength={500} />
        <TextField
          label={`Type the election title to confirm: ${election.title}`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
      </div>
    </Dialog>
  );
}
