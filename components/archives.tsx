"use client";

import clsx from "clsx";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ElectionTimes, StateBadge, TallyPositions, TallyStats, TallyUpdated } from "./election";
import { IconArchive, IconArrowRight, IconCheck, IconMail, IconSearch, IconSend, IconTrophy, Logo } from "./icons";
import { useDebounced } from "./staff";
import { Alert, BackLink, Badge, Button, Dialog, EmptyState, ErrorState, Input, PageHeader, PageSpinner, Pagination, Skeleton } from "./ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { ArchivedElectionOut, ElectionOut, Page, ShareResultsOut, TallyOut } from "@/lib/api/types";
import { formatDate, formatWAT } from "@/lib/time";

type Base = "/admin/archives" | "/super-admin/archives";
const PAGE_SIZE = 12;

// ---- list -----------------------------------------------------------------------------------------

export function ArchivesList({ basePath }: { basePath: Base }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  const { data, error, isPending, refetch, isFetching } = useQuery({
    queryKey: ["archives", q, page],
    queryFn: () => api<Page<ArchivedElectionOut>>("admin/elections/archived", { query: { search: q.trim() || undefined, page, page_size: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        eyebrow="Archives"
        title="Closed elections"
        description="Every election that has finished — on schedule or stopped early — with its final results."
        actions={
          <div className="relative w-full sm:w-72">
            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              placeholder="Search by title"
              aria-label="Search closed elections"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        }
      />

      {isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-[28px]" />
          ))}
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title={q ? "No matching elections" : "No closed elections yet"} icon={<IconArchive size={20} />}>
          {q ? "Try a different title." : "When an election ends, it moves here with its final results."}
        </EmptyState>
      ) : (
        <div className={clsx("transition-opacity", isFetching && "opacity-70")}>
          <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((item) => (
              <ArchiveCard key={item.election.id} item={item} href={`${basePath}/${item.election.id}`} />
            ))}
          </div>
          {data.total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
        </div>
      )}
    </>
  );
}

function ArchiveCard({ item, href }: { item: ArchivedElectionOut; href: string }) {
  const { election: e } = item;
  const shown = item.winners.slice(0, 3);
  const more = item.winners.length - shown.length;
  const turnout = Math.min(item.turnout_percentage, 100);

  return (
    <Link
      href={href}
      className="surface group flex flex-col p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="num text-xs font-medium text-muted">Closed {formatDate(e.closed_at)}</span>
        <div className="flex items-center gap-1.5">
          {e.results_share?.status === "sent" && (
            <Badge tone="info" className="!h-5 !px-2">
              <IconMail size={11} /> Emailed
            </Badge>
          )}
          <StateBadge election={e} />
        </div>
      </div>
      <h3 className="mt-3 line-clamp-2 text-lg font-extrabold leading-snug tracking-tight">{e.title}</h3>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-subtle px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-muted">Ballots cast</p>
          <p className="num text-xl font-extrabold tracking-tight">{item.total_votes.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl bg-subtle px-3.5 py-2.5">
          <p className="text-[11px] font-medium text-muted">Turnout</p>
          <p className="num text-xl font-extrabold tracking-tight">{item.turnout_percentage.toFixed(1)}%</p>
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-series-track" aria-hidden="true">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${turnout}%` }} />
          </span>
        </div>
      </div>

      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {shown.map((w) => (
          <li key={w.position} className="flex items-center gap-2.5 text-sm">
            <span className={clsx("flex size-6 shrink-0 items-center justify-center rounded-full", w.names.length ? "bg-primary-soft text-primary" : "bg-subtle text-muted")}>
              <IconTrophy size={13} />
            </span>
            <span className="min-w-0 flex-1 truncate">
              <span className="text-muted">{w.position}: </span>
              <span className="font-semibold">{w.names.length ? w.names.join(" & ") : "No votes"}</span>
            </span>
          </li>
        ))}
        {more > 0 && <li className="pl-8.5 text-xs text-muted">+{more} more position{more === 1 ? "" : "s"}</li>}
      </ul>

      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        View results <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

// ---- detail ---------------------------------------------------------------------------------------

export function ArchiveDetail({ id, basePath }: { id: string; basePath: Base }) {
  const election = useQuery({ queryKey: ["election", id], queryFn: () => api<ElectionOut>(`admin/elections/${id}`) });
  const tally = useQuery({
    queryKey: ["tally", id],
    queryFn: () => api<TallyOut>(`admin/elections/${id}/tally`),
    enabled: election.data?.state === "ended",
  });

  if (election.isPending) return <PageSpinner />;
  if (election.error) return <ErrorState error={election.error} onRetry={() => void election.refetch()} />;
  const e = election.data;
  const livePath = basePath === "/admin/archives" ? `/admin/elections/${id}` : `/super-admin/elections/${id}`;

  if (e.state !== "ended") {
    return (
      <div className="flex flex-col gap-6">
        <BackLink href={basePath}>Archives</BackLink>
        <Alert tone="info" title="This election is not closed yet">
          Only finished elections appear in the archives.{" "}
          <Link href={livePath} className="font-semibold underline">
            Open the election
          </Link>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href={basePath}>Archives</BackLink>
        <div className="flex items-center gap-2">
          <StateBadge election={e} />
          <span className="num text-xs text-muted">Closed {formatWAT(e.closed_at)}</span>
        </div>
        <h1 className="mt-3 text-[28px] font-extrabold leading-tight tracking-[-0.03em]">{e.title}</h1>
        {e.description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{e.description}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Timeline election={e} />
        <ShareResultsCard election={e} tally={tally.data} />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-extrabold tracking-tight">Final results</h2>
          {tally.data && <TallyUpdated tally={tally.data} />}
        </div>
        {tally.isPending ? (
          <PageSpinner label="Counting the ballots…" />
        ) : tally.error ? (
          <ErrorState error={tally.error} onRetry={() => void tally.refetch()} />
        ) : (
          <>
            <TallyStats tally={tally.data} />
            <TallyPositions tally={tally.data} final />
          </>
        )}
      </section>
    </div>
  );
}

function Timeline({ election: e }: { election: ElectionOut }) {
  const steps = [
    { label: "Created", at: e.created_at, tone: "muted" as const },
    e.published_at && { label: "Published to students", at: e.published_at, tone: "muted" as const },
    { label: "Voting opened", at: e.start_time, tone: "primary" as const },
    e.stopped_at
      ? { label: "Stopped early by the super admin", at: e.stopped_at, tone: "danger" as const, note: e.stop_reason }
      : { label: "Voting closed", at: e.end_time, tone: "primary" as const },
    e.results_share && {
      label: e.results_share.status === "failed" ? "Results email failed" : "Results emailed to students",
      at: e.results_share.requested_at,
      tone: (e.results_share.status === "failed" ? "danger" : "info") as "danger" | "info",
      note: e.results_share.requested_by_email ? `By ${e.results_share.requested_by_email}` : null,
    },
  ].filter(Boolean) as { label: string; at: string; tone: "muted" | "primary" | "danger" | "info"; note?: string | null }[];

  const dot = { muted: "bg-border-strong", primary: "bg-primary", danger: "bg-danger", info: "bg-info" };
  return (
    <section className="surface p-6">
      <h2 className="text-base font-bold tracking-tight">Timeline</h2>
      <ol className="relative mt-4 flex flex-col gap-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">
        {steps.map((s) => (
          <li key={s.label} className="relative flex gap-4 pl-0">
            <span className={clsx("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-card", dot[s.tone])} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{s.label}</p>
              <p className="num text-xs text-muted">{formatWAT(s.at)}</p>
              {s.note && <p className="mt-1 text-xs text-muted">“{s.note}”</p>}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 border-t border-border pt-4">
        <ElectionTimes election={e} />
      </div>
    </section>
  );
}

// ---- share results by email -----------------------------------------------------------------------

/** Email the final results to every registered student. Used in archives and on ended election pages. */
export function ShareResultsCard({ election, tally, className }: { election: ElectionOut; tally?: TallyOut; className?: string }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // Follow progress while the backend is sending.
  const { data } = useQuery({
    queryKey: ["election", election.id],
    queryFn: () => api<ElectionOut>(`admin/elections/${election.id}`),
    initialData: election,
    refetchInterval: (q) => (q.state.data?.results_share?.status === "sending" ? 3000 : false),
  });
  const e = data ?? election;
  const share = e.results_share;

  // Needed for the email preview when the parent didn't load it.
  const ownTally = useQuery({
    queryKey: ["tally", election.id],
    queryFn: () => api<TallyOut>(`admin/elections/${election.id}/tally`),
    enabled: !tally && confirming,
  });
  const previewTally = tally ?? ownTally.data;

  if (e.state !== "ended") return null;

  const send = async () => {
    setBusy(true);
    try {
      const res = await api<ShareResultsOut>(`admin/elections/${e.id}/share-results`, { json: { resend: share?.status === "sent" } });
      queryClient.setQueryData(["election", e.id], res.election);
      void queryClient.invalidateQueries({ queryKey: ["archives"] });
      toast.success(res.message);
      setConfirming(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const progress = share && share.recipients ? Math.round(((share.sent + share.failed) / share.recipients) * 100) : 0;

  return (
    <section className={clsx("surface relative flex flex-col overflow-hidden p-6", className)}>
      <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-primary-soft opacity-70 blur-2xl" aria-hidden="true" />
      <div className="relative flex items-start gap-4">
        <span
          className={clsx(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl",
            share?.status === "sent" ? "bg-primary text-primary-fg" : "bg-primary-soft text-primary",
          )}
        >
          {share?.status === "sent" ? <IconCheck size={22} strokeWidth={2.5} /> : <IconMail size={22} />}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight">
            {share?.status === "sent" ? "Results emailed" : share?.status === "sending" ? "Sending results…" : "Email the results"}
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-muted">
            {share?.status === "sent" ? (
              <>
                Delivered to <span className="num font-semibold text-foreground">{share.sent.toLocaleString()}</span> student
                {share.sent === 1 ? "" : "s"} on {formatWAT(share.completed_at ?? share.requested_at)}
                {share.requested_by_email ? ` by ${share.requested_by_email}` : ""}.
              </>
            ) : share?.status === "sending" ? (
              "Students are receiving a branded summary of the winners and turnout."
            ) : e.auto_share_results ? (
              "Automatic sending is on — the summary goes out to every registered student within a minute of voting closing."
            ) : (
              "Send every registered student a summary of the winners and turnout, straight to their inbox."
            )}
          </p>
        </div>
      </div>

      {share?.status === "sending" && (
        <div className="relative mt-5">
          <div className="flex justify-between text-xs text-muted">
            <span className="num">
              {(share.sent + share.failed).toLocaleString()} of {share.recipients.toLocaleString()}
            </span>
            <span className="num">{progress}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-series-track">
            <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${Math.max(progress, 4)}%` }} />
          </div>
        </div>
      )}
      {share && share.failed > 0 && share.status !== "sending" && (
        <Alert tone={share.status === "failed" ? "danger" : "warning"} className="relative mt-4">
          {share.failed.toLocaleString()} email{share.failed === 1 ? "" : "s"} could not be delivered.
          {share.status === "failed" && " Check the mail server settings and try again."}
        </Alert>
      )}

      <div className="relative mt-auto flex flex-wrap gap-2 pt-5">
        {share?.status !== "sending" && (
          <Button variant={share?.status === "sent" ? "secondary" : "primary"} onClick={() => setConfirming(true)}>
            <IconSend size={15} />
            {share?.status === "sent" ? "Send again" : share?.status === "failed" ? "Try again" : "Share results"}
          </Button>
        )}
      </div>

      {confirming && (
        <Dialog
          open
          wide
          onClose={() => setConfirming(false)}
          dismissible={!busy}
          title={share?.status === "sent" ? "Send the results again?" : "Email the results to students?"}
          description="Every registered student with an email address will receive this summary."
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={send} loading={busy}>
                <IconSend size={15} /> {share?.status === "sent" ? "Send again" : "Send to students"}
              </Button>
            </>
          }
        >
          {share?.status === "sent" && (
            <Alert tone="warning" className="mb-4">
              Students already received these results on {formatWAT(share.requested_at)}. They will get a second copy.
            </Alert>
          )}
          <EmailPreview election={e} tally={previewTally} />
        </Dialog>
      )}
    </section>
  );
}

/** A faithful miniature of the results email (voting-BD email_service.election_results). */
function EmailPreview({ election, tally }: { election: ElectionOut; tally?: TallyOut }) {
  return (
    <div className="rounded-3xl bg-background p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Logo size={22} />
        <span className="text-[13px] font-extrabold tracking-tight">Eksumsa Decides</span>
        <span className="ml-auto text-[11px] text-muted">Subject: Results: {election.title}</span>
      </div>
      <div className="rounded-[22px] border border-card-border bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold text-primary">Official results</p>
        <p className="mt-1 text-xl font-extrabold leading-tight tracking-[-0.03em]">{election.title}</p>
        <p className="num mt-1 text-xs text-muted">Voting closed {formatWAT(election.closed_at)}</p>
        {!tally ? (
          <PageSpinner label="Preparing preview…" />
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { l: "Ballots cast", v: tally.total_votes.toLocaleString() },
                { l: "Turnout", v: `${tally.turnout_percentage.toFixed(1)}%` },
                { l: "Eligible", v: tally.eligible_voters.toLocaleString() },
              ].map((s) => (
                <div key={s.l} className="rounded-xl bg-subtle px-3 py-2">
                  <p className="text-[10px] font-medium text-muted">{s.l}</p>
                  <p className="num text-base font-extrabold">{s.v}</p>
                </div>
              ))}
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {tally.positions.map((p) => {
                const winners = p.candidates.filter((c) => p.winner_ids.includes(c.id));
                return (
                  <li key={p.id} className="rounded-2xl border border-border px-3.5 py-2.5">
                    <p className="text-[13px] font-bold">{p.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                      <IconTrophy size={12} className="text-primary" />
                      {winners.length ? (
                        <span>
                          <span className="font-semibold text-primary">{winners.length > 1 ? "Joint winners" : "Winner"}:</span>{" "}
                          <span className="font-bold">{winners.map((w) => w.full_name).join(" & ")}</span>
                        </span>
                      ) : (
                        <span className="text-muted">No votes cast</span>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 inline-flex h-9 items-center rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-fg">View results online</div>
          </>
        )}
      </div>
    </div>
  );
}
