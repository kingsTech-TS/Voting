"use client";

import clsx from "clsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { IconAlert, IconArrowRight, IconCalendar, IconCheck } from "@/components/icons";
import { Alert, Button, Card, Dialog, ErrorState, Input, PageHeader, PageSpinner, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { SessionAdvanceOut, SessionStateOut } from "@/lib/api/types";
import { formatDate, formatWAT } from "@/lib/time";

const FINAL = "600";
const NEXT: Record<string, string> = { "100": "200", "200": "300", "300": "400", "400": "500", "500": "600" };

/** Academic years start around September: Nov 2026 → 2026/2027, Mar 2027 → 2026/2027. */
function suggestedSession(): string {
  const now = new Date();
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}/${y + 1}`;
}

export function SessionPage() {
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["session"],
    queryFn: () => api<SessionStateOut>("admin/session"),
  });
  const [advancing, setAdvancing] = useState(false);
  const [lastResult, setLastResult] = useState<SessionAdvanceOut | null>(null);

  if (isPending) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <>
      <PageHeader
        eyebrow="Academic session"
        title="Session & levels"
        description="Set the current academic session. Starting a new session moves every student up one level."
      />
      {!data.current ? (
        <SetInitial />
      ) : (
        <div className="flex flex-col gap-4">
          {lastResult && (
            <Alert tone="success" title={`${lastResult.state.current} has started`}>
              {lastResult.promoted.toLocaleString()} students moved up a level and {lastResult.graduated_deleted.toLocaleString()} graduating{" "}
              {FINAL} level students were deleted. Admins have been messaged to import the new 100 level.
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <CurrentCard state={data} onAdvance={() => setAdvancing(true)} />
            <LevelsCard state={data} />
          </div>
          <HistoryCard state={data} />
        </div>
      )}
      {advancing && data.current && data.next && (
        <AdvanceDialog
          state={data}
          onClose={() => setAdvancing(false)}
          onDone={(r) => {
            setLastResult(r);
            setAdvancing(false);
          }}
        />
      )}
    </>
  );
}

// ---- first-time setup -----------------------------------------------------------------------------

function SetInitial() {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(suggestedSession());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const m = /^(\d{4})\/(\d{4})$/.exec(value.trim());
    if (!m || Number(m[2]) !== Number(m[1]) + 1) return setError("Write two consecutive years, e.g. 2026/2027.");
    setLoading(true);
    setError(null);
    try {
      const state = await api<SessionStateOut>("super-admin/session", { method: "PUT", json: { session: value.trim() } });
      queryClient.setQueryData(["session"], state);
      toast.success(`Current session set to ${state.current}.`);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <Card className="mx-auto flex max-w-lg flex-col items-center gap-5 py-10 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <IconCalendar size={26} />
      </span>
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Set the current session</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Which academic session are the students on the list in right now? Nobody&apos;s level changes when you set it.
        </p>
      </div>
      <form onSubmit={submit} className="flex w-full max-w-xs flex-col gap-3" noValidate>
        <TextField
          label="Current session"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
          placeholder="2026/2027"
          inputMode="numeric"
          className="text-left"
        />
        <Button type="submit" size="lg" loading={loading}>
          Set session
        </Button>
      </form>
    </Card>
  );
}

// ---- cards ----------------------------------------------------------------------------------------

function CurrentCard({ state, onAdvance }: { state: SessionStateOut; onAdvance: () => void }) {
  return (
    <section className="surface relative flex flex-col overflow-hidden p-6">
      <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-primary-soft opacity-80 blur-2xl" aria-hidden="true" />
      <p className="relative text-xs font-semibold text-muted">Current session</p>
      <p className="num relative mt-1 text-[44px] font-extrabold leading-none tracking-[-0.04em]">{state.current}</p>
      <p className="relative mt-2 text-xs text-muted">Since {formatDate(state.started_at)}</p>
      <p className="num relative mt-4 text-sm">
        <span className="font-extrabold">{state.total_students.toLocaleString()}</span> <span className="text-muted">students on the list</span>
      </p>
      <div className="relative mt-auto pt-6">
        <Button size="lg" className="w-full" onClick={onAdvance}>
          Start {state.next} session <IconArrowRight size={16} />
        </Button>
        <p className="mt-2 text-center text-xs text-muted">Moves everyone up a level. You&apos;ll confirm each step.</p>
      </div>
    </section>
  );
}

function LevelsCard({ state }: { state: SessionStateOut }) {
  const max = Math.max(1, ...state.levels.map((l) => l.count));
  return (
    <section className="surface p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight">Students by level</h2>
        <span className="text-xs text-muted">Next session</span>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {state.levels.map((l) => (
          <li key={l.level} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3">
            <span className="num text-sm font-extrabold">{l.level}</span>
            <span className="relative h-7 overflow-hidden rounded-lg bg-subtle">
              <span
                className={clsx("absolute inset-y-0 left-0 rounded-lg transition-[width] duration-700", l.level === FINAL ? "bg-danger/70" : "bg-primary/80")}
                style={{ width: `${(l.count / max) * 100}%` }}
              />
              <span className="num relative flex h-full items-center px-2.5 text-xs font-bold">{l.count.toLocaleString()}</span>
            </span>
            <span className={clsx("num w-28 text-right text-xs font-semibold", l.level === FINAL ? "text-danger" : "text-muted")}>
              {l.level === FINAL ? "Graduate · deleted" : `→ ${NEXT[l.level]} level`}
            </span>
          </li>
        ))}
      </ul>
      {state.other_levels.length > 0 && (
        <p className="mt-4 rounded-xl bg-subtle px-3 py-2 text-xs text-muted">
          Not changed by a new session:{" "}
          {state.other_levels.map((l) => (
            <span key={l.level} className="mr-2 font-semibold text-foreground">
              {l.level} ({l.count})
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

function HistoryCard({ state }: { state: SessionStateOut }) {
  if (state.history.length === 0) return null;
  return (
    <section className="surface p-6">
      <h2 className="text-base font-bold tracking-tight">History</h2>
      <ol className="mt-3 flex flex-col divide-y divide-border">
        {state.history.map((h, i) => (
          <li key={`${h.session}-${h.started_at}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="flex items-center gap-3">
              <span className={clsx("size-2.5 rounded-full", i === 0 ? "bg-primary" : "bg-border-strong")} aria-hidden="true" />
              <span className="num text-sm font-extrabold">{h.session}</span>
              {i === 0 && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">Current</span>}
            </div>
            <p className="text-xs text-muted">
              {formatWAT(h.started_at)}
              {h.started_by_email && <> · {h.started_by_email}</>}
              {(h.promoted > 0 || h.graduated_deleted > 0) && (
                <>
                  {" "}
                  · {h.promoted.toLocaleString()} moved up, {h.graduated_deleted.toLocaleString()} graduated
                </>
              )}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---- start next session ---------------------------------------------------------------------------

function AdvanceDialog({
  state,
  onClose,
  onDone,
}: {
  state: SessionStateOut;
  onClose: () => void;
  onDone: (r: SessionAdvanceOut) => void;
}) {
  const queryClient = useQueryClient();
  const finalCount = state.levels.find((l) => l.level === FINAL)?.count ?? 0;
  const [step, setStep] = useState<1 | 2>(finalCount > 0 ? 1 : 2);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const next = state.next ?? "";

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<SessionAdvanceOut>("super-admin/session/advance", {
        json: { to_session: next, delete_final_level: confirmDelete },
      });
      queryClient.setQueryData(["session"], res.state);
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(`${res.state.current} session started.`);
      onDone(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : errorMessage(err));
      void queryClient.invalidateQueries({ queryKey: ["session"] });
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      dismissible={!loading}
      title={`Start the ${next} session`}
      description={`Currently ${state.current}`}
      footer={
        step === 1 ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!confirmDelete} onClick={() => setStep(2)}>
              Continue
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => (finalCount > 0 ? setStep(1) : onClose())} disabled={loading}>
              {finalCount > 0 ? "Back" : "Cancel"}
            </Button>
            <Button onClick={run} loading={loading} disabled={typed.trim() !== next}>
              Start {next}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {error && <Alert tone="danger">{error}</Alert>}

        {step === 1 ? (
          <>
            <div className="flex gap-4 rounded-2xl bg-danger-soft p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-danger text-white">
                <IconAlert size={20} />
              </span>
              <div>
                <p className="font-bold">Step 1 — Remove the graduating {FINAL} level</p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                  <span className="num font-extrabold">{finalCount.toLocaleString()}</span> students are in {FINAL} level. Before everyone
                  moves up, they must be deleted from the system — accounts, emails, passwords and profile pictures. Their past votes stay
                  in old results. This can&apos;t be undone.
                </p>
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 hover:bg-subtle">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[var(--danger)]"
                checked={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.checked)}
              />
              <span className="text-sm">
                Yes, delete all <span className="num font-bold">{finalCount.toLocaleString()}</span> {FINAL} level students
              </span>
            </label>
          </>
        ) : (
          <>
            <div>
              <p className="font-bold">{finalCount > 0 ? "Step 2 — " : ""}Everyone moves up one level</p>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {state.levels
                  .filter((l) => l.level !== FINAL)
                  .map((l) => (
                    <li key={l.level} className="flex items-center justify-between rounded-xl bg-subtle px-4 py-2.5 text-sm">
                      <span className="num flex items-center gap-2 font-extrabold">
                        {l.level} <IconArrowRight size={14} className="text-muted" /> {NEXT[l.level]}
                      </span>
                      <span className="num text-xs text-muted">{l.count.toLocaleString()} students</span>
                    </li>
                  ))}
              </ul>
              {finalCount > 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-danger">
                  <IconCheck size={13} strokeWidth={3} /> {finalCount.toLocaleString()} {FINAL} level students will be deleted first.
                </p>
              )}
            </div>
            <div className="rounded-2xl bg-primary-soft p-4 text-sm">
              <p className="font-bold text-primary">Then — add the new 100 level</p>
              <p className="mt-1 text-foreground/80">
                100 level will be empty. All admins get a message asking them to import the new 100 level list.
              </p>
            </div>
            <div>
              <label className="text-[13px] font-medium" htmlFor="confirm-session">
                Type <span className="num font-extrabold">{next}</span> to confirm
              </label>
              <Input
                id="confirm-session"
                className="mt-1.5"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                placeholder={next}
              />
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
