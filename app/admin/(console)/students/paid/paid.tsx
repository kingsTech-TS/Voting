"use client";

import clsx from "clsx";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { IconAlert, IconCheck, IconUpload } from "@/components/icons";
import { buttonClass } from "@/components/styles";
import { Alert, BackLink, Badge, Button, Card, PageHeader, Pagination, Table, Td, Th } from "@/components/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { PaidConfirmOut, PaidPreviewOut, PaidPreviewRow, PaidRowStatus } from "@/lib/api/types";
import { FORMAT_INFO, ImportingScene, Stepper, Tip, UploadStep, csvCell, download, useCountUp, type Step } from "../import/import";

const PAGE_SIZE = 100;

const STATUS: Record<PaidRowStatus, { label: string; tone: "success" | "neutral" | "warning" | "danger" | "info" }> = {
  mark: { label: "Will be marked paid", tone: "success" },
  already: { label: "Already paid", tone: "neutral" },
  not_found: { label: "No match", tone: "danger" },
  ambiguous: { label: "Several matches", tone: "warning" },
  duplicate: { label: "Duplicate", tone: "warning" },
  invalid: { label: "Can't read", tone: "warning" },
};

type Tab = "mark" | "not_found" | "ambiguous" | "already" | "invalid";

/** Names on the paid list that couldn't be matched to exactly one student. */
type Unmatched = { name: string; problem: string };

export function PaidImport() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<PaidPreviewOut | null>(null);
  const [result, setResult] = useState<{ out: PaidConfirmOut; unmatched: Unmatched[] } | null>(null);

  const reset = () => {
    setPreview(null);
    setResult(null);
    setStep("upload");
  };

  return (
    <>
      <BackLink href="/admin/students">Students</BackLink>
      <PageHeader
        title="Import paid list"
        description="Upload the list of students who have paid their dues. Only paid students can vote. Names are matched against the student list, and anyone who can't be matched is flagged."
      />
      <Stepper step={step} reviewLabel="Review matches" />

      {step === "upload" && (
        <UploadStep<PaidPreviewOut>
          endpoint="admin/students/paid/preview"
          heading="Drop the paid list here"
          reading="Matching names against the student list"
          onPreview={(p) => {
            setPreview(p);
            setStep("review");
          }}
          tips={
            <>
              <Tip>
                Each paid student&apos;s <b>full name</b> (at least surname and first name). Students are matched by name in any order —{" "}
                <i>OKAFOR Adaeze</i> matches <i>Adaeze Okafor</i>. Matric numbers, amounts and receipts in the file are ignored.
              </Tip>
              <Tip>
                A name with a missing or extra middle name is a <b>partial match</b> — check it before confirming.
              </Tip>
              <Tip>Any level, in one file. Students already marked as paid are left as they are.</Tip>
              <Tip>
                Names that match nobody, or more than one student, are <b>flagged</b> so you can fix them by hand.
              </Tip>
              <Tip>CSV, Excel, Word or PDF. PDFs must contain real text, not a scanned image.</Tip>
            </>
          }
        />
      )}
      {step === "review" && preview && (
        <Review
          preview={preview}
          onBack={reset}
          onDone={(out, unmatched) => {
            setResult({ out, unmatched });
            setStep("done");
            void queryClient.invalidateQueries({ queryKey: ["students"] });
            void queryClient.invalidateQueries({ queryKey: ["session"] });
          }}
        />
      )}
      {step === "done" && result && <Done result={result.out} unmatched={result.unmatched} onAnother={reset} />}
    </>
  );
}

function downloadUnmatched(rows: Unmatched[]) {
  const lines = ["name_in_paid_list,problem", ...rows.map((r) => [r.name, r.problem].map(csvCell).join(","))];
  download("paid-but-not-matched.csv", lines.join("\n") + "\n");
}

function Review({
  preview,
  onBack,
  onDone,
}: {
  preview: PaidPreviewOut;
  onBack: () => void;
  onDone: (r: PaidConfirmOut, unmatched: Unmatched[]) => void;
}) {
  const c = preview.counts;
  const [tab, setTab] = useState<Tab>(c.mark > 0 ? "mark" : c.not_found > 0 ? "not_found" : c.ambiguous > 0 ? "ambiguous" : "already");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  // Matches the admin unticked (e.g. a wrong partial match): left unpaid.
  const [excluded, setExcluded] = useState<Set<number>>(new Set());

  const rows = useMemo(
    () => preview.rows.filter((r) => (tab === "invalid" ? r.status === "invalid" || r.status === "duplicate" : r.status === tab)),
    [preview.rows, tab],
  );
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const matches = preview.rows.filter((r) => r.status === "mark" && r.identifier);
  const toMark = matches.filter((r) => !excluded.has(r.line));
  const partial = matches.filter((r) => r.match === "partial").length;
  const unmatched: Unmatched[] = preview.rows
    .filter((r) => r.status === "not_found" || r.status === "ambiguous")
    .map((r) => ({ name: r.name_in_file, problem: r.note ?? STATUS[r.status].label }));
  const fmt = FORMAT_INFO[preview.format];

  const toggle = (line: number) =>
    setExcluded((s) => {
      const next = new Set(s);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });

  const confirm = async () => {
    setSaving(true);
    try {
      const res = await api<PaidConfirmOut>("admin/students/paid/confirm", {
        json: { identifiers: toMark.map((r) => r.identifier), filename: preview.filename, format: preview.format },
      });
      toast.success(`${res.marked.toLocaleString()} student${res.marked === 1 ? "" : "s"} marked as paid.`);
      onDone(res, unmatched);
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  };

  const tabs: [Tab, string, number][] = [
    ["mark", "To mark paid", c.mark],
    ["not_found", "No match", c.not_found],
    ...(c.ambiguous > 0 ? ([["ambiguous", "Several matches", c.ambiguous]] as [Tab, string, number][]) : []),
    ["already", "Already paid", c.already],
    ["invalid", "Can't read", c.invalid + c.duplicate],
  ];
  const flagged = c.not_found + c.ambiguous;

  return (
    <div className="flex flex-col gap-4">
      {saving && (
        <ImportingScene
          names={toMark.map((r) => r.student_name ?? r.name_in_file)}
          title={<>Marking {toMark.length.toLocaleString()} student{toMark.length === 1 ? "" : "s"} as paid…</>}
        />
      )}
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={clsx("flex size-11 shrink-0 items-center justify-center rounded-2xl text-[11px] font-extrabold", fmt.tone)}>{fmt.ext}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{preview.filename}</p>
              <p className="text-xs text-muted">
                {fmt.label} · <span className="num">{preview.rows.length.toLocaleString()}</span> names found
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} disabled={saving}>
            Choose a different file
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { k: "mark", label: "Will be marked paid", v: c.mark, cls: "text-primary" },
            { k: "flagged", label: "Not matched", v: flagged, cls: flagged ? "text-danger" : "" },
            { k: "already", label: "Already paid", v: c.already, cls: "" },
            { k: "invalid", label: "Can't read", v: c.invalid + c.duplicate, cls: "" },
          ].map((s) => (
            <div key={s.k} className={clsx("rounded-2xl px-4 py-3", s.k === "flagged" && flagged ? "bg-danger-soft" : "bg-subtle")}>
              <p className="text-xs font-medium text-muted">{s.label}</p>
              <p className={clsx("num text-2xl font-extrabold tracking-tight", s.cls)}>{s.v.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </Card>

      {partial > 0 && (
        <Alert tone="warning" title={`${partial.toLocaleString()} partial name match${partial === 1 ? "" : "es"}`}>
          Some names only partly match a student (for example a missing middle name). Check them in the &ldquo;To mark paid&rdquo; tab and untick any
          that are the wrong student.
        </Alert>
      )}
      {flagged > 0 && (
        <Alert tone="danger" title={`${flagged.toLocaleString()} name${flagged === 1 ? "" : "s"} on the paid list couldn't be matched`}>
          {c.not_found > 0 && <>{c.not_found.toLocaleString()} match no student — check the spelling or add the student first. </>}
          {c.ambiguous > 0 && <>{c.ambiguous.toLocaleString()} match more than one student — mark the right one as paid on the Students page. </>}
          <button type="button" className="font-semibold underline" onClick={() => downloadUnmatched(unmatched)}>
            Download the list
          </button>
        </Alert>
      )}
      {c.mark === 0 && flagged === 0 && c.already > 0 && (
        <Alert tone="info" title="Everyone on this list is already marked as paid">
          There&apos;s nothing new to update.
        </Alert>
      )}

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap rounded-xl bg-subtle p-1 text-[13px] font-semibold" role="tablist">
          {tabs.map(([k, label, n]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => {
                setTab(k);
                setPage(1);
              }}
              className={clsx(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors",
                tab === k ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {(k === "not_found" || k === "ambiguous") && n > 0 && <IconAlert size={13} className="text-danger" />}
              {label} <span className="num text-muted">{n.toLocaleString()}</span>
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl bg-subtle px-4 py-8 text-center text-sm text-muted">Nothing here.</p>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  {tab === "mark" && <Th className="w-10"><span className="sr-only">Mark as paid</span></Th>}
                  <Th>Line</Th>
                  <Th>Name in file</Th>
                  <Th>Matched student</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <PaidRow
                    key={r.line}
                    row={r}
                    selectable={tab === "mark"}
                    checked={!excluded.has(r.line)}
                    onToggle={() => toggle(r.line)}
                  />
                ))}
              </tbody>
            </Table>
            {rows.length > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} />}
          </>
        )}
      </Card>

      <div className="surface sticky bottom-4 z-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="num font-extrabold text-primary">{toMark.length.toLocaleString()}</span> student{toMark.length === 1 ? "" : "s"} will be
          marked as paid
          {flagged > 0 && (
            <>
              {" "}
              · <span className="num font-bold text-danger">{flagged.toLocaleString()}</span> not matched
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onBack} disabled={saving}>
            Back
          </Button>
          <Button onClick={confirm} loading={saving} disabled={toMark.length === 0}>
            <IconCheck size={16} /> Mark {toMark.length.toLocaleString()} as paid
          </Button>
        </div>
      </div>
    </div>
  );
}

function PaidRow({
  row: r,
  selectable,
  checked,
  onToggle,
}: {
  row: PaidPreviewRow;
  selectable: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const s = STATUS[r.status];
  const off = selectable && !checked;
  return (
    <tr className={clsx(r.status === "not_found" && "bg-danger-soft/40", off && "text-muted")}>
      {selectable && (
        <Td>
          <input
            type="checkbox"
            aria-label={`Mark ${r.student_name ?? r.name_in_file} as paid`}
            className="size-4 accent-[var(--primary)]"
            checked={checked}
            onChange={onToggle}
          />
        </Td>
      )}
      <Td className="num text-muted">{r.line}</Td>
      <Td>{r.name_in_file || "—"}</Td>
      <Td>
        {r.student_name ? (
          <>
            <p className="font-medium">{r.student_name}</p>
            <p className="text-xs text-muted">
              <span className="font-mono">{r.identifier}</span> · {r.level} level
            </p>
          </>
        ) : (
          <p className="text-muted">—</p>
        )}
      </Td>
      <Td>
        <span className="flex flex-wrap gap-1">
          <Badge tone={off ? "neutral" : s.tone}>{off ? "Won't be marked" : s.label}</Badge>
          {r.match === "partial" && <Badge tone="warning">Partial match</Badge>}
        </span>
        {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
      </Td>
    </tr>
  );
}

function Done({ result, unmatched, onAnother }: { result: PaidConfirmOut; unmatched: Unmatched[]; onAnother: () => void }) {
  const marked = useCountUp(result.marked);
  return (
    <Card className="flex flex-col gap-6">
      <div className="animate-pop flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-fg shadow-[0_12px_28px_-10px_var(--primary)]">
          <IconCheck size={28} strokeWidth={3} />
        </span>
        <div>
          <p className="num text-3xl font-extrabold tracking-tight">{marked.toLocaleString()}</p>
          <p className="text-sm text-muted">student{result.marked === 1 ? "" : "s"} marked as paid — they can now vote</p>
        </div>
      </div>
      {unmatched.length > 0 && (
        <Alert tone="danger" title={`${unmatched.length.toLocaleString()} name${unmatched.length === 1 ? "" : "s"} not matched`}>
          {unmatched
            .slice(0, 12)
            .map((u) => u.name)
            .join(", ")}
          {unmatched.length > 12 && ` and ${unmatched.length - 12} more`}. Mark them as paid by hand on the Students page.{" "}
          <button type="button" className="font-semibold underline" onClick={() => downloadUnmatched(unmatched)}>
            Download the list
          </button>
        </Alert>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={onAnother}>
          <IconUpload size={16} /> Import another paid list
        </Button>
        <Link href="/admin/students" className={buttonClass("primary")}>
          View students
        </Link>
      </div>
    </Card>
  );
}
