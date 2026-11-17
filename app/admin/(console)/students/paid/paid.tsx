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
import { FORMAT_INFO, Stepper, Tip, UploadStep, csvCell, download, type Step } from "../import/import";

const PAGE_SIZE = 100;

const STATUS: Record<PaidRowStatus, { label: string; tone: "success" | "neutral" | "warning" | "danger" | "info" }> = {
  mark: { label: "Will be marked paid", tone: "success" },
  already: { label: "Already paid", tone: "neutral" },
  not_found: { label: "Not in student list", tone: "danger" },
  duplicate: { label: "Duplicate", tone: "warning" },
  invalid: { label: "Can't read", tone: "warning" },
};

type Tab = "mark" | "not_found" | "already" | "invalid";

export function PaidImport() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<PaidPreviewOut | null>(null);
  const [result, setResult] = useState<PaidConfirmOut | null>(null);

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
        description="Upload the list of students who have paid their dues. Only paid students can vote. Students on the paid list who aren't on the student list are flagged."
      />
      <Stepper step={step} reviewLabel="Review matches" />

      {step === "upload" && (
        <UploadStep<PaidPreviewOut>
          endpoint="admin/students/paid/preview"
          heading="Drop the paid list here"
          reading="Matching Matric/Reg numbers against the student list"
          onPreview={(p) => {
            setPreview(p);
            setStep("review");
          }}
          tips={
            <>
              <Tip>
                Each paid student&apos;s <b>Matric</b> or <b>Registration number</b>. Names, amounts and receipt numbers can be in the file
                too — students are matched by their number.
              </Tip>
              <Tip>Any level, in one file. Students already marked as paid are left as they are.</Tip>
              <Tip>
                Anyone on the paid list who isn&apos;t on the student list is <b>flagged</b> so you can add them first.
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
          onDone={(r) => {
            setResult(r);
            setStep("done");
            void queryClient.invalidateQueries({ queryKey: ["students"] });
            void queryClient.invalidateQueries({ queryKey: ["session"] });
          }}
        />
      )}
      {step === "done" && result && <Done result={result} onAnother={reset} />}
    </>
  );
}

function downloadNotFound(rows: { identifier: string; name?: string }[]) {
  const lines = ["identifier,name_in_paid_list,problem", ...rows.map((r) => [r.identifier, r.name ?? "", "Not in the student list"].map(csvCell).join(","))];
  download("paid-but-not-in-student-list.csv", lines.join("\n") + "\n");
}

function Review({ preview, onBack, onDone }: { preview: PaidPreviewOut; onBack: () => void; onDone: (r: PaidConfirmOut) => void }) {
  const [tab, setTab] = useState<Tab>(preview.counts.mark > 0 ? "mark" : preview.counts.not_found > 0 ? "not_found" : "already");
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const c = preview.counts;

  const rows = useMemo(
    () => preview.rows.filter((r) => (tab === "invalid" ? r.status === "invalid" || r.status === "duplicate" : r.status === tab)),
    [preview.rows, tab],
  );
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const toMark = preview.rows.filter((r) => r.status === "mark");
  const notFound = preview.rows.filter((r) => r.status === "not_found");
  const fmt = FORMAT_INFO[preview.format];

  const confirm = async () => {
    setSaving(true);
    try {
      const res = await api<PaidConfirmOut>("admin/students/paid/confirm", {
        json: { identifiers: toMark.map((r) => r.identifier), filename: preview.filename, format: preview.format },
      });
      toast.success(`${res.marked.toLocaleString()} student${res.marked === 1 ? "" : "s"} marked as paid.`);
      onDone({ ...res, not_found: notFound.map((r) => r.identifier) });
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  };

  const tabs: [Tab, string, number][] = [
    ["mark", "To mark paid", c.mark],
    ["not_found", "Not in student list", c.not_found],
    ["already", "Already paid", c.already],
    ["invalid", "Can't read", c.invalid + c.duplicate],
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={clsx("flex size-11 shrink-0 items-center justify-center rounded-2xl text-[11px] font-extrabold", fmt.tone)}>{fmt.ext}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{preview.filename}</p>
              <p className="text-xs text-muted">
                {fmt.label} · <span className="num">{preview.rows.length.toLocaleString()}</span> entries found
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
            { k: "not_found", label: "Not in student list", v: c.not_found, cls: c.not_found ? "text-danger" : "" },
            { k: "already", label: "Already paid", v: c.already, cls: "" },
            { k: "invalid", label: "Can't read", v: c.invalid + c.duplicate, cls: "" },
          ].map((s) => (
            <div key={s.k} className={clsx("rounded-2xl px-4 py-3", s.k === "not_found" && c.not_found ? "bg-danger-soft" : "bg-subtle")}>
              <p className="text-xs font-medium text-muted">{s.label}</p>
              <p className={clsx("num text-2xl font-extrabold tracking-tight", s.cls)}>{s.v.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </Card>

      {c.not_found > 0 && (
        <Alert tone="danger" title={`${c.not_found.toLocaleString()} student${c.not_found === 1 ? " is" : "s are"} on the paid list but not on the student list`}>
          They can&apos;t be marked as paid until they&apos;re added. Add them on the Students page (or import their class list), then import this
          paid list again.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => downloadNotFound(notFound.map((r) => ({ identifier: r.identifier, name: r.name_in_file })))}
          >
            Download the list
          </button>
        </Alert>
      )}
      {c.mark === 0 && c.not_found === 0 && c.already > 0 && (
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
              {k === "not_found" && n > 0 && <IconAlert size={13} className="text-danger" />}
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
                  <Th>Line</Th>
                  <Th>Matric / Reg no.</Th>
                  <Th>Student</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <PaidRow key={r.line} row={r} />
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
          {c.not_found > 0 && (
            <>
              {" "}
              · <span className="num font-bold text-danger">{c.not_found.toLocaleString()}</span> flagged
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

function PaidRow({ row: r }: { row: PaidPreviewRow }) {
  const s = STATUS[r.status];
  return (
    <tr className={r.status === "not_found" ? "bg-danger-soft/40" : undefined}>
      <Td className="num text-muted">{r.line}</Td>
      <Td className="font-mono text-xs">{r.identifier || "—"}</Td>
      <Td>
        {r.student_name ? (
          <>
            <p className="font-medium">{r.student_name}</p>
            <p className="text-xs text-muted">{r.level} level</p>
          </>
        ) : (
          <p className="text-muted">{r.name_in_file || "—"}</p>
        )}
      </Td>
      <Td>
        <Badge tone={s.tone}>{s.label}</Badge>
        {r.note && r.status !== "mark" && <p className="mt-1 text-xs text-muted">{r.note}</p>}
      </Td>
    </tr>
  );
}

function Done({ result, onAnother }: { result: PaidConfirmOut; onAnother: () => void }) {
  return (
    <Card className="flex flex-col gap-6">
      <div className="animate-pop flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-fg shadow-[0_12px_28px_-10px_var(--primary)]">
          <IconCheck size={28} strokeWidth={3} />
        </span>
        <div>
          <p className="num text-3xl font-extrabold tracking-tight">{result.marked.toLocaleString()}</p>
          <p className="text-sm text-muted">student{result.marked === 1 ? "" : "s"} marked as paid — they can now vote</p>
        </div>
      </div>
      {result.not_found.length > 0 && (
        <Alert tone="danger" title={`${result.not_found.length.toLocaleString()} not found in the student list`}>
          {result.not_found.slice(0, 12).join(", ")}
          {result.not_found.length > 12 && ` and ${result.not_found.length - 12} more`}.{" "}
          <button type="button" className="font-semibold underline" onClick={() => downloadNotFound(result.not_found.map((identifier) => ({ identifier })))}>
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
