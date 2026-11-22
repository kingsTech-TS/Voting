"use client";

import clsx from "clsx";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api } from "@/lib/api/client";
import type {
  CandidateOut,
  CandidateResult,
  CandidateVoterOut,
  ElectionOut,
  ElectionState,
  Page,
  PositionResult,
  TallyOut,
} from "@/lib/api/types";
import { Donut, LegendStat, withSeriesColors } from "./charts";
import { formatClock, formatWAT, serverNow } from "@/lib/time";
import { checkImage } from "@/lib/validation";
import { BlobImage } from "./blob-image";
import { IconChevronDown, IconImage, IconUsers } from "./icons";
import { Avatar, Badge, Button, Dialog, ErrorState, PageSpinner, Pagination, Table, Td, Th } from "./ui";

// ---- state badge ----------------------------------------------------------------------------------

const STATE_LABEL: Record<ElectionState, string> = {
  draft: "Draft",
  upcoming: "Scheduled",
  ongoing: "Voting open",
  ended: "Closed",
};

export function StateBadge({ election }: { election: Pick<ElectionOut, "state" | "status"> }) {
  const tone = { draft: "neutral", upcoming: "info", ongoing: "success", ended: "neutral" } as const;
  if (election.status === "stopped") {
    return (
      <Badge tone="danger" dot>
        Stopped
      </Badge>
    );
  }
  return (
    <Badge tone={tone[election.state]} dot={election.state === "ongoing" ? "pulse" : true}>
      {STATE_LABEL[election.state]}
    </Badge>
  );
}

// ---- countdown ------------------------------------------------------------------------------------

/** Ticks every second; calls onDone once when the target (server time) is reached. */
export function useCountdown(targetIso: string | null | undefined, onDone?: () => void) {
  const target = targetIso ? new Date(targetIso).getTime() : null;
  const [remaining, setRemaining] = useState(() => (target ? target - serverNow() : 0));
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (!target) return;
    let fired = false;
    const tick = () => {
      const left = target - serverNow();
      setRemaining(left);
      if (left <= 0 && !fired) {
        fired = true;
        doneRef.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return remaining;
}

function splitDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function Countdown({ to, label, onDone, compact }: { to: string; label: string; onDone?: () => void; compact?: boolean }) {
  const remaining = useCountdown(to, onDone);
  const { d, h, m, s } = splitDuration(remaining);
  const units = [
    ...(d > 0 ? [{ v: d, u: "days" }] : []),
    { v: h, u: "hrs" },
    { v: m, u: "min" },
    { v: s, u: "sec" },
  ];
  const text = `${d ? `${d} days ` : ""}${h} hours ${m} minutes`;

  if (compact) {
    return (
      <p className="text-sm text-muted">
        {label}{" "}
        <span className="num font-medium text-foreground">
          {d > 0 && `${d}d `}
          {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </span>
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="mt-3 flex items-end gap-1.5" role="timer" aria-label={`${label} ${text}`}>
        {remaining <= 0 ? (
          <span className="num text-4xl font-extrabold">Now</span>
        ) : (
          units.map((x, i) => (
            <div key={x.u} className="flex items-end gap-1.5">
              {i > 0 && <span className="num pb-6 text-2xl font-bold text-border-strong">:</span>}
              <div className="flex flex-col items-center">
                <span className="num min-w-[2.4ch] overflow-hidden rounded-2xl bg-subtle px-2.5 py-2 text-center text-[34px] font-extrabold leading-none tracking-tight sm:text-[40px]">
                  <span key={x.v} className="animate-digit">{String(x.v).padStart(2, "0")}</span>
                </span>
                <span className="mt-1.5 text-[11px] font-medium text-muted">{x.u}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ---- election summary -----------------------------------------------------------------------------

export function ElectionTimes({ election }: { election: ElectionOut }) {
  const rows = [
    { k: "Opens", v: formatWAT(election.start_time) },
    { k: election.status === "stopped" ? "Was due to close" : "Closes", v: formatWAT(election.end_time) },
  ];
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
      {rows.map((r) => (
        <div key={r.k}>
          <dt className="text-xs font-medium text-muted">{r.k}</dt>
          <dd className="num mt-0.5 text-sm font-bold">{r.v}</dd>
        </div>
      ))}
      {election.stopped_at && (
        <div>
          <dt className="text-xs font-medium text-danger">Stopped</dt>
          <dd className="mt-0.5 text-[13px]">
            <span className="num">{formatWAT(election.stopped_at)}</span>
            {election.stop_reason && <span className="text-muted"> — “{election.stop_reason}”</span>}
          </dd>
        </div>
      )}
    </dl>
  );
}

export function CandidateTile({ candidate, size = 64 }: { candidate: CandidateOut; size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar src={candidate.image_url} name={candidate.full_name} size={size} className="rounded-lg" />
      <span className="font-medium">{candidate.full_name}</span>
    </div>
  );
}

/** Read-only list of positions and candidates. */
export function BallotPreview({ election }: { election: ElectionOut }) {
  return (
    <div className="flex flex-col gap-8">
      {election.positions.map((p, i) => (
        <section key={p.id}>
          <h3 className="mb-3 flex items-baseline gap-3 text-sm font-semibold">
            <span className="num text-muted">{String(i + 1).padStart(2, "0")}</span>
            {p.name}
          </h3>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {p.candidates.map((c) => (
              <div key={c.id} className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-card-border">
                <div className="aspect-square bg-subtle">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt={c.full_name} className="size-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted">
                      <IconImage size={22} />
                    </div>
                  )}
                </div>
                <p className="truncate px-2.5 py-2 text-[13px] font-medium">{c.full_name}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ---- results / tally ------------------------------------------------------------------------------

export function TallyStats({ tally }: { tally: TallyOut }) {
  const notVoted = Math.max(tally.eligible_voters - tally.total_votes, 0);
  const turnout = [{ key: "voted", label: "Voted", value: tally.total_votes, color: "var(--series-1)" }];
  return (
    <section className="surface grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:items-center" aria-live="polite">
      <div className="flex items-center justify-center gap-5">
        <LegendStat color="var(--series-track)" label="Not voted" value={notVoted.toLocaleString()} />
        <Donut
          segments={turnout}
          total={Math.max(tally.eligible_voters, tally.total_votes)}
          size={168}
          thickness={18}
          label={`Turnout ${tally.turnout_percentage.toFixed(1)} percent: ${tally.total_votes} of ${tally.eligible_voters} students`}
          center={() => (
            <>
              <span className="num text-[32px] font-extrabold leading-none tracking-tight">{tally.turnout_percentage.toFixed(0)}%</span>
              <span className="mt-1 text-xs text-muted">turnout</span>
            </>
          )}
        />
        <LegendStat color="var(--series-1)" label="Voted" value={tally.total_votes.toLocaleString()} align="right" />
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {[
          { label: "Ballots cast", value: tally.total_votes },
          { label: "Turnout", value: `${tally.turnout_percentage.toFixed(1)}%` },
          { label: "Registered", value: tally.registered_voters },
          { label: "Eligible", value: tally.eligible_voters },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-subtle px-4 py-3">
            <dt className="text-xs font-medium text-muted">{s.label}</dt>
            <dd className="num mt-0.5 text-2xl font-extrabold tracking-tight">
              {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PositionResultCard({
  position,
  index,
  final,
  electionId,
}: {
  position: PositionResult;
  index: number;
  final?: boolean;
  electionId?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewing, setViewing] = useState<CandidateResult | null>(null);
  const segments = withSeriesColors(position.candidates);
  const colorOf = new Map(segments.map((s) => [s.key, s.color]));
  const total = position.candidates.reduce((n, c) => n + c.votes, 0);
  const leader = position.candidates[0];
  const tie = position.winner_ids.length > 1;
  const legendL = segments[1];
  const legendR = segments[0];

  return (
    <section className="surface p-6">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-extrabold tracking-tight">{position.name}</h3>
        <span className="num text-xs text-muted">#{String(index + 1).padStart(2, "0")}</span>
      </header>
      <p className="mt-3 text-xs font-semibold">{final ? "Results" : "Live count"}</p>

      <div className="mt-3 flex items-center justify-between gap-3">
        {legendL ? <LegendStat color={legendL.color} label={legendL.label} value={legendL.value.toLocaleString()} /> : <span />}
        <Donut
          segments={segments}
          total={total}
          size={170}
          thickness={18}
          active={active}
          onActive={setActive}
          label={`${position.name}: ${position.candidates.map((c) => `${c.full_name} ${c.votes}`).join(", ")}`}
          center={(seg) => {
            const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
            if (seg) {
              return (
                <>
                  <span className="max-w-24 truncate text-xs font-semibold text-muted">{seg.label}</span>
                  <span className="num text-[30px] font-extrabold leading-tight tracking-tight">{pct(seg.value)}%</span>
                </>
              );
            }
            if (!leader || total === 0) return <span className="text-xs text-muted">No votes yet</span>;
            return (
              <>
                <span className="max-w-24 truncate text-xs font-semibold text-muted">{tie ? "Tied" : leader.full_name.split(" ")[0]}</span>
                <span className="num text-[30px] font-extrabold leading-tight tracking-tight">{pct(leader.votes)}%</span>
              </>
            );
          }}
        />
        {legendR ? (
          <LegendStat color={legendR.color} label={legendR.label} value={legendR.value.toLocaleString()} align="right" />
        ) : (
          <span />
        )}
      </div>

      <ol className="mt-5 flex flex-col">
        {position.candidates.map((c, i) => {
          const winner = final && position.winner_ids.includes(c.id);
          const color = colorOf.get(c.id) ?? "var(--muted)";
          const open = expanded === c.id;
          return (
            <li
              key={c.id}
              onMouseEnter={() => setActive(colorOf.has(c.id) ? c.id : "__other")}
              onMouseLeave={() => setActive(null)}
              className={clsx(
                "-mx-2 rounded-2xl px-2 transition-colors",
                (open || active === c.id || (active === "__other" && !colorOf.has(c.id))) && "bg-subtle",
              )}
            >
              <button
                type="button"
                onClick={() => setExpanded(open ? null : c.id)}
                aria-expanded={open}
                aria-label={`${c.full_name}: ${c.votes} votes. ${open ? "Hide" : "Show"} votes by level`}
                className="flex w-full items-center gap-3 py-2 text-left"
              >
                <span className="num w-4 text-xs text-muted">{i + 1}</span>
                <Avatar src={c.image_url} name={c.full_name} size={34} />
                <span className="min-w-0 flex-1">
                  <span className={clsx("block truncate text-sm", winner ? "font-bold" : "font-semibold")}>{c.full_name}</span>
                  {winner && <span className="text-xs font-semibold text-primary">{tie ? "Joint winner" : "Winner"}</span>}
                </span>
                <span className="num text-right text-sm font-bold">{c.votes.toLocaleString()}</span>
                <span className="num w-12 text-right text-xs text-muted">{c.percentage.toFixed(1)}%</span>
                <span className="size-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                <IconChevronDown size={14} className={clsx("shrink-0 text-muted transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <LevelBreakdown
                  candidate={c}
                  color={color}
                  onViewVoters={electionId ? () => setViewing(c) : undefined}
                />
              )}
            </li>
          );
        })}
      </ol>
      {electionId && viewing && (
        <CandidateVotersDialog
          electionId={electionId}
          positionId={position.id}
          candidate={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </section>
  );
}

function levelLabel(level: string) {
  return /^\d+$/.test(level) ? `${level} level` : level;
}

/** How many of a candidate's votes came from each level. */
function LevelBreakdown({ candidate, color, onViewVoters }: { candidate: CandidateResult; color: string; onViewVoters?: () => void }) {
  const levels = candidate.level_breakdown ?? [];
  const max = Math.max(1, ...levels.map((l) => l.votes));
  return (
    <div className="animate-fade-in pb-3 pl-7 pr-1">
      <p className="mb-2 text-xs font-semibold text-muted">Votes by level</p>
      {levels.length === 0 ? (
        <p className="text-xs text-muted">No votes yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {levels.map((l) => {
            const share = candidate.votes ? Math.round((l.votes / candidate.votes) * 100) : 0;
            return (
              <li key={l.level} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-xs">
                <span className="truncate font-medium">{levelLabel(l.level)}</span>
                <span className="h-2 overflow-hidden rounded-full bg-series-track" aria-hidden="true">
                  <span className="block h-full rounded-full" style={{ width: `${(l.votes / max) * 100}%`, background: color }} />
                </span>
                <span className="num text-right">
                  <span className="font-bold">{l.votes.toLocaleString()}</span>
                  <span className="text-muted"> · {share}%</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {onViewVoters && candidate.votes > 0 && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onViewVoters}>
          <IconUsers size={14} /> View voters
        </Button>
      )}
    </div>
  );
}

const VOTERS_PAGE_SIZE = 50;

/** Staff only: who voted for a candidate, identified by unique name (never real name). */
function CandidateVotersDialog({
  electionId,
  positionId,
  candidate,
  onClose,
}: {
  electionId: string;
  positionId: string;
  candidate: CandidateResult;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [level, setLevel] = useState("");
  const levels = candidate.level_breakdown ?? [];
  const { data, error, isPending, refetch, isFetching } = useQuery({
    queryKey: ["candidate-voters", electionId, candidate.id, level, page],
    queryFn: () =>
      api<Page<CandidateVoterOut>>(`admin/elections/${electionId}/positions/${positionId}/candidates/${candidate.id}/voters`, {
        query: { page, page_size: VOTERS_PAGE_SIZE, level: level || undefined },
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={`Voters for ${candidate.full_name}`}
      description="Students appear by their unique name only. Real names are never shown here."
    >
      <div className="flex flex-col gap-4">
        {levels.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by level">
            {[{ level: "", votes: candidate.votes }, ...levels].map((l) => (
              <button
                key={l.level || "all"}
                type="button"
                aria-pressed={level === l.level}
                onClick={() => {
                  setLevel(l.level);
                  setPage(1);
                }}
                className={clsx(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  level === l.level ? "bg-primary text-primary-fg" : "bg-subtle text-muted hover:text-foreground",
                )}
              >
                {l.level ? levelLabel(l.level) : "All"} <span className="num opacity-80">{l.votes.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
        {isPending ? (
          <PageSpinner label="Loading voters…" />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : data.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No voters found.</p>
        ) : (
          <div className={clsx("transition-opacity", isFetching && "opacity-60")}>
            <Table>
              <thead>
                <tr>
                  <Th className="w-12">#</Th>
                  <Th>Unique name</Th>
                  <Th>Level</Th>
                  <Th className="text-right">Voted at (WAT)</Th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((v, i) => (
                  <tr key={`${v.unique_name}-${v.voted_at}`}>
                    <Td className="num text-muted">{(data.page - 1) * data.page_size + i + 1}</Td>
                    <Td className={clsx("num font-semibold", v.unique_name === "Removed student" && "text-muted")}>{v.unique_name}</Td>
                    <Td>{levelLabel(v.level)}</Td>
                    <Td className="num text-right text-muted">{formatWAT(v.voted_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />
          </div>
        )}
      </div>
    </Dialog>
  );
}

/**
 * `electionId` enables staff-only extras (the voter list per candidate). Leave it out for students:
 * they see the per-level breakdown but not who voted.
 */
export function TallyPositions({ tally, final, electionId }: { tally: TallyOut; final?: boolean; electionId?: string }) {
  return (
    <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-2">
      {tally.positions.map((p, i) => (
        <PositionResultCard key={p.id} position={p} index={i} final={final} electionId={electionId} />
      ))}
    </div>
  );
}

export function TallyUpdated({ tally }: { tally: TallyOut }) {
  return (
    <p className="text-xs text-muted">
      {tally.source === "live" ? "Live count" : "Counted from the database"} · <span className="num">{formatClock(tally.updated_at)}</span> WAT
    </p>
  );
}

// ---- image picker ---------------------------------------------------------------------------------

export function ImagePicker({
  file,
  onChange,
  error,
  round,
  label = "Choose image",
}: {
  file: File | null;
  onChange: (file: File | null, error: string | null) => void;
  error?: string | null;
  round?: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (f: File | null | undefined) => {
    if (!f) return;
    const problem = checkImage(f);
    onChange(problem ? null : f, problem);
  };

  const onSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    accept(f);
  };

  return (
    <div className="flex flex-col items-center gap-4" data-invalid={error ? true : undefined}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={clsx(
          "group relative flex size-40 items-center justify-center overflow-hidden border bg-subtle transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          round ? "rounded-full" : "rounded-2xl",
          file ? "border-border" : "border-dashed border-border-strong hover:border-primary",
          dragging && "border-primary bg-primary-soft",
          error && "border-danger",
        )}
        aria-label={label}
      >
        {file ? (
          <>
            <BlobImage file={file} alt="Selected image preview" className="size-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-ink/70 py-1.5 text-center text-xs font-medium text-ink-fg opacity-0 transition-opacity group-hover:opacity-100">
              Change
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 px-4 text-center text-xs text-muted">
            <IconImage size={22} />
            <span>
              <span className="font-medium text-foreground">Choose a photo</span>
              <br />
              or drop it here
            </span>
          </span>
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onSelect} tabIndex={-1} />
      <div className="flex flex-col items-center gap-1">
        {file && (
          <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
            Choose a different photo
          </Button>
        )}
        <p className="text-xs text-muted">JPEG, PNG or WebP · up to 5 MB</p>
      </div>
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
