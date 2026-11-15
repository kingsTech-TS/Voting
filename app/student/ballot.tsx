"use client";

import clsx from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { IconCheck } from "@/components/icons";
import { Alert, Avatar, Button, Dialog } from "@/components/ui";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { DashboardOut, ElectionOut, VoteOut } from "@/lib/api/types";

type Selections = Record<string, string>; // position_id -> candidate_id

const storageKey = (electionId: string) => `ballot:${electionId}`;

/** Restore an in-progress ballot after an accidental reload, dropping ids that no longer exist. */
function loadSelections(election: ElectionOut): Selections {
  if (typeof window === "undefined") return {};
  let saved: Selections = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(storageKey(election.id)) || "{}");
  } catch {
    return {};
  }
  const valid: Selections = {};
  for (const p of election.positions) {
    if (saved[p.id] && p.candidates.some((c) => c.id === saved[p.id])) valid[p.id] = saved[p.id];
  }
  return valid;
}

/** Render with `key={election.id}` so a different election starts a fresh ballot. */
export function Ballot({ election }: { election: ElectionOut }) {
  const queryClient = useQueryClient();
  // The ballot only mounts after client-side data loads, so reading sessionStorage here is safe.
  const [selections, setSelections] = useState<Selections>(() => loadSelections(election));
  const [missing, setMissing] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (positionId: string, candidateId: string) => {
    setSelections((prev) => {
      const next = { ...prev, [positionId]: candidateId };
      try {
        sessionStorage.setItem(storageKey(election.id), JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setMissing((m) => m.filter((id) => id !== positionId));
  };

  const total = election.positions.length;
  const chosen = election.positions.filter((p) => selections[p.id]).length;

  const review = () => {
    const notChosen = election.positions.filter((p) => !selections[p.id]).map((p) => p.id);
    setMissing(notChosen);
    if (notChosen.length) {
      document.getElementById(`position-${notChosen[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError(null);
    setReviewing(true);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api<VoteOut>(`elections/${election.id}/vote`, {
        json: { selections: Object.entries(selections).map(([position_id, candidate_id]) => ({ position_id, candidate_id })) },
      });
      try {
        sessionStorage.removeItem(storageKey(election.id));
      } catch {
        // ignore
      }
      toast.success(res.message);
      queryClient.setQueryData<DashboardOut>(["student", "dashboard"], (old) =>
        old ? { ...old, state: "voted", message: res.message } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ["student", "dashboard"] });
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError) {
        if (["ALREADY_VOTED", "VOTING_ENDED", "VOTING_NOT_STARTED", "NOT_FOUND"].includes(err.code)) {
          toast.message(err.message);
          setReviewing(false);
          void queryClient.invalidateQueries({ queryKey: ["student", "dashboard"] });
          return;
        }
        if (err.code === "INCOMPLETE_BALLOT" || err.code === "INVALID_BALLOT") {
          setReviewing(false);
          void queryClient.invalidateQueries({ queryKey: ["student", "dashboard"] });
        }
      }
      setError(errorMessage(err));
    }
  };

  return (
    <form
      className="flex flex-col gap-12 pb-32"
      onSubmit={(e) => {
        e.preventDefault();
        review();
      }}
    >
      {error && !reviewing && <Alert tone="danger">{error}</Alert>}

      {election.positions.map((position, index) => {
        const isMissing = missing.includes(position.id);
        const done = !!selections[position.id];
        return (
          <fieldset key={position.id} id={`position-${position.id}`} className="scroll-mt-24">
            <legend className="contents">
              <span className="flex items-baseline gap-3 border-b border-border pb-3">
                <span className="num text-sm text-muted">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-lg font-semibold tracking-[-0.01em]">{position.name}</span>
                <span
                  className={clsx(
                    "ml-auto flex items-center gap-1.5 text-xs",
                    isMissing ? "font-medium text-danger" : done ? "text-primary" : "text-muted",
                  )}
                >
                  {done && <IconCheck size={13} strokeWidth={2.5} />}
                  {isMissing ? "Choose one to continue" : done ? "Chosen" : "Choose one"}
                </span>
              </span>
            </legend>
            <div className="stagger mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {position.candidates.map((c) => {
                const selected = selections[position.id] === c.id;
                const dimmed = done && !selected;
                return (
                  <label
                    key={c.id}
                    className={clsx(
                      "group relative cursor-pointer overflow-hidden rounded-2xl border-2 bg-card shadow-[var(--shadow-card)] transition-[border-color,box-shadow,opacity] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                      selected ? "border-primary" : "border-transparent hover:border-border-strong",
                      dimmed && "opacity-60 hover:opacity-100",
                      isMissing && !done && "border-danger/50",
                    )}
                  >
                    <input
                      type="radio"
                      name={`position-${position.id}`}
                      value={c.id}
                      checked={selected}
                      onChange={() => choose(position.id, c.id)}
                      className="sr-only"
                    />
                    <div className="aspect-[4/5] bg-subtle">
                      {c.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image_url} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Avatar name={c.full_name} size={64} />
                        </div>
                      )}
                    </div>
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full border transition-colors",
                        selected ? "border-primary bg-primary text-primary-fg" : "border-white/70 bg-black/20 backdrop-blur-sm",
                      )}
                    >
                      {selected && (
                        <span className="animate-pop flex">
                          <IconCheck size={14} strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-2 px-3 py-2.5">
                      <span className={clsx("truncate text-sm", selected ? "font-semibold" : "font-medium")}>{c.full_name}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-[13px]">
              <span className="num font-medium">
                {chosen}/{total}
              </span>{" "}
              <span className="text-muted">positions chosen</span>
            </p>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {election.positions.map((p) => (
                <span key={p.id} className={clsx("h-1 flex-1 rounded-full transition-colors", selections[p.id] ? "bg-primary" : "bg-border")} />
              ))}
            </div>
          </div>
          <Button type="submit" size="lg" variant={chosen === total ? "primary" : "ink"}>
            Review ballot
          </Button>
        </div>
      </div>

      <Dialog
        open={reviewing}
        onClose={() => !submitting && setReviewing(false)}
        dismissible={!submitting}
        title="Review your ballot"
        description="You can vote only once. Choices can't be changed after you submit."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewing(false)} disabled={submitting}>
              Change choices
            </Button>
            <Button onClick={submit} loading={submitting}>
              Cast my vote
            </Button>
          </>
        }
      >
        {error && (
          <Alert tone="danger" className="mb-4">
            {error}
          </Alert>
        )}
        <ol className="divide-y divide-border rounded-2xl bg-subtle">
          {election.positions.map((p, i) => {
            const c = p.candidates.find((x) => x.id === selections[p.id]);
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="num w-5 text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-muted">{p.name}</span>
                  <span className="block truncate text-sm font-medium">{c?.full_name}</span>
                </span>
                {c && <Avatar src={c.image_url} name={c.full_name} size={36} />}
              </li>
            );
          })}
        </ol>
      </Dialog>
    </form>
  );
}
