"use client";

import clsx from "clsx";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { IconArchive, IconCheck, IconFile, IconUpload, IconUsers } from "@/components/icons";
import { buttonClass } from "@/components/styles";
import { Alert, BackLink, Badge, Button, Card, Input, PageHeader, Pagination, Spinner, Table, Td, Th } from "@/components/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { BulkImportOut, ImportFormat, ImportPreviewOut, ImportPreviewRow, ImportRowStatus } from "@/lib/api/types";
import { LEVEL_RE, MAX_CSV_BYTES, MAX_DOC_BYTES } from "@/lib/validation";

const TEMPLATE = "identifier,full_name\n220703012,Jane Doe\n202650372846LA,John Smith\n";
const LEVELS = ["100", "200", "300", "400", "500", "600"];
const PAGE_SIZE = 100;

const FORMAT_INFO: Record<ImportFormat, { label: string; ext: string; tone: string }> = {
  csv: { label: "CSV", ext: "CSV", tone: "bg-primary-soft text-primary" },
  xlsx: { label: "Excel", ext: "XLSX", tone: "bg-primary-soft text-primary" },
  docx: { label: "Word", ext: "DOCX", tone: "bg-info-soft text-info" },
  pdf: { label: "PDF", ext: "PDF", tone: "bg-danger-soft text-danger" },
};

const STATUS: Record<ImportRowStatus, { label: string; tone: "success" | "neutral" | "warning" | "danger" }> = {
  new: { label: "Ready", tone: "success" },
  exists: { label: "Already added", tone: "neutral" },
  duplicate: { label: "Duplicate", tone: "warning" },
  invalid: { label: "Can't read", tone: "danger" },
};

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function formatOf(f: File): ImportFormat | null {
  const n = f.name.toLowerCase();
  if (n.endsWith(".csv") || f.type === "text/csv") return "csv";
  if (n.endsWith(".xlsx")) return "xlsx";
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".pdf") || f.type === "application/pdf") return "pdf";
  return null;
}

type Step = "upload" | "review" | "done";

export function ImportStudents() {
  const queryClient = useQueryClient();
  const levelParam = useSearchParams().get("level") ?? "";
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<ImportPreviewOut | null>(null);
  const [result, setResult] = useState<{ out: BulkImportOut; level: string } | null>(null);

  const reset = () => {
    setPreview(null);
    setResult(null);
    setStep("upload");
  };

  return (
    <>
      <BackLink href="/admin/students">Students</BackLink>
      <PageHeader
        title="Import students"
        description="Upload a class list as CSV, Excel, Word or PDF. You'll check the students we found and choose their level before anything is saved."
        actions={
          <Button variant="secondary" onClick={() => download("students-template.csv", TEMPLATE)}>
            <IconFile size={16} /> CSV template
          </Button>
        }
      />
      <Stepper step={step} />

      {step === "upload" && (
        <UploadStep
          onPreview={(p) => {
            setPreview(p);
            setStep("review");
          }}
        />
      )}
      {step === "review" && preview && (
        <ReviewStep
          preview={preview}
          initialLevel={levelParam}
          onBack={reset}
          onDone={(out, level) => {
            setResult({ out, level });
            setStep("done");
            void queryClient.invalidateQueries({ queryKey: ["students"] });
          }}
        />
      )}
      {step === "done" && result && <ResultStep result={result.out} level={result.level} onAnother={reset} />}
    </>
  );
}

// ---- stepper --------------------------------------------------------------------------------------

function Stepper({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "upload", label: "Upload file" },
    { key: "review", label: "Review & choose level" },
    { key: "done", label: "Done" },
  ];
  const current = steps.findIndex((s) => s.key === step);
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-[13px] font-semibold" aria-label="Import steps">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            {i > 0 && <span className={clsx("h-px w-6 sm:w-10", done || active ? "bg-primary" : "bg-border-strong")} aria-hidden="true" />}
            <span
              className={clsx(
                "flex size-6 items-center justify-center rounded-full text-xs transition-colors",
                done || active ? "bg-primary text-primary-fg" : "bg-card text-muted ring-1 ring-border",
              )}
            >
              {done ? <IconCheck size={12} strokeWidth={3} /> : i + 1}
            </span>
            <span className={active ? "text-foreground" : "text-muted"}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---- step 1: upload -------------------------------------------------------------------------------

function UploadStep({ onPreview }: { onPreview: (p: ImportPreviewOut) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const pick = async (f: File | null | undefined) => {
    if (!f) return;
    const fmt = formatOf(f);
    if (!fmt) {
      setProblem(
        /\.doc$/i.test(f.name)
          ? "Old .doc files aren't supported. Save it as .docx in Word and try again."
          : /\.xls$/i.test(f.name)
            ? "Old .xls files aren't supported. Save it as .xlsx (Excel Workbook) and try again."
            : "Choose a CSV, Excel (.xlsx), Word (.docx) or PDF file.",
      );
      return;
    }
    const limit = fmt === "csv" ? MAX_CSV_BYTES : MAX_DOC_BYTES;
    if (f.size > limit) {
      setProblem(`${FORMAT_INFO[fmt].label} files must be at most ${limit / 1024 / 1024} MB.`);
      return;
    }
    setProblem(null);
    setReading(f);
    try {
      const form = new FormData();
      form.append("file", f);
      onPreview(await api<ImportPreviewOut>("admin/students/bulk/preview", { form }));
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setReading(null);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!reading) void pick(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            "flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors",
            dragging ? "border-primary bg-primary-soft" : "border-border-strong bg-subtle/50",
          )}
        >
          {reading ? (
            <>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-card text-primary shadow-[var(--shadow-card)]">
                <Spinner className="size-6" />
              </span>
              <div>
                <p className="text-sm font-semibold">Reading {reading.name}…</p>
                <p className="mt-1 text-xs text-muted">Finding Matric/Reg numbers and names</p>
              </div>
            </>
          ) : (
            <>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-card text-primary shadow-[var(--shadow-card)]">
                <IconUpload size={24} />
              </span>
              <div>
                <p className="text-base font-bold">Drop your class list here</p>
                <p className="mt-1 text-sm text-muted">CSV up to 2 MB · Excel, Word or PDF up to 10 MB</p>
              </div>
              <div className="flex gap-2" aria-hidden="true">
                {(Object.keys(FORMAT_INFO) as ImportFormat[]).map((k) => (
                  <span key={k} className={clsx("rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wide", FORMAT_INFO[k].tone)}>
                    {FORMAT_INFO[k].ext}
                  </span>
                ))}
              </div>
              <Button onClick={() => inputRef.current?.click()}>Browse files</Button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf"
            className="sr-only"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {problem && <Alert tone="danger">{problem}</Alert>}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-bold tracking-tight">What the file needs</h2>
        <ul className="flex flex-col gap-3 text-sm">
          <Tip>
            Each student&apos;s <b>Matric number</b> (9 or 10 digits) or <b>Registration number</b> (12 digits + 2 letters) next to their{" "}
            <b>full name</b>.
          </Tip>
          <Tip>
            A table with headings like <b>Matric No</b> and <b>Name</b> (or <b>Surname</b> + <b>Other Names</b>) works best. Plain lists
            work too.
          </Tip>
          <Tip>
            No level column needed — you&apos;ll choose the level for everyone in the file in the next step. Upload one level at a time.
          </Tip>
          <Tip>PDFs must contain real text. Scanned images can&apos;t be read — use the original Word or Excel file instead.</Tip>
        </ul>
      </Card>
    </div>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 leading-relaxed text-foreground/85">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <IconCheck size={11} strokeWidth={3} />
      </span>
      <span>{children}</span>
    </li>
  );
}

// ---- step 2: review + level -----------------------------------------------------------------------

type Filter = "new" | "invalid";

function ReviewStep({
  preview,
  initialLevel,
  onBack,
  onDone,
}: {
  preview: ImportPreviewOut;
  initialLevel: string;
  onBack: () => void;
  onDone: (out: BulkImportOut, level: string) => void;
}) {
  if (preview.already_imported) return <AlreadyImported preview={preview} onBack={onBack} />;
  return <ReviewNew preview={preview} initialLevel={initialLevel} onBack={onBack} onDone={onDone} />;
}

function AlreadyImported({ preview, onBack }: { preview: ImportPreviewOut; onBack: () => void }) {
  const fmt = FORMAT_INFO[preview.format];
  return (
    <Card className="flex flex-col items-center gap-5 py-12 text-center">
      <span className="animate-pop flex size-16 items-center justify-center rounded-full bg-info-soft text-info">
        <IconArchive size={28} />
      </span>
      <div className="max-w-md">
        <h2 className="text-xl font-extrabold tracking-tight">This list has already been imported</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          All <span className="num font-semibold text-foreground">{preview.counts.exists.toLocaleString()}</span> students in{" "}
          <span className="font-semibold text-foreground">{preview.filename}</span> ({fmt.label}) are already on the student list.
          There&apos;s nothing new to add.
        </p>
        {preview.counts.invalid > 0 && (
          <p className="mt-2 text-xs text-muted">
            {preview.counts.invalid} line{preview.counts.invalid === 1 ? "" : "s"} couldn&apos;t be read and were ignored.
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={onBack}>
          <IconUpload size={16} /> Upload a different list
        </Button>
        <Link href="/admin/students" className={buttonClass("primary")}>
          View students
        </Link>
      </div>
    </Card>
  );
}

function ReviewNew({
  preview,
  initialLevel,
  onBack,
  onDone,
}: {
  preview: ImportPreviewOut;
  initialLevel: string;
  onBack: () => void;
  onDone: (out: BulkImportOut, level: string) => void;
}) {
  const suggested = initialLevel || (preview.levels_in_file.length === 1 ? preview.levels_in_file[0] : "");
  const [level, setLevel] = useState(LEVELS.includes(suggested) ? suggested : "");
  const [customLevel, setCustomLevel] = useState(suggested && !LEVELS.includes(suggested) ? suggested : "");
  const [useCustom, setUseCustom] = useState(Boolean(suggested && !LEVELS.includes(suggested)));
  const [names, setNames] = useState<Record<number, string>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<Filter>(preview.counts.new === 0 ? "invalid" : "new");
  const [page, setPage] = useState(1);
  const [levelError, setLevelError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const chosenLevel = (useCustom ? customLevel : level).trim();
  const nameOf = (r: ImportPreviewRow) => names[r.line] ?? r.full_name;
  const selectable = preview.rows.filter((r) => r.status === "new");
  const selected = selectable.filter((r) => !excluded.has(r.line));
  const badNames = selected.filter((r) => nameOf(r).trim().length < 2);

  const visible = useMemo(
    () =>
      // Students already in the system (and repeats within the file) are never shown: only new names.
      preview.rows.filter((r) => r.status === filter),
    [preview.rows, filter],
  );
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allOnPage = pageRows.filter((r) => r.status === "new");
  const allOnPageChecked = allOnPage.length > 0 && allOnPage.every((r) => !excluded.has(r.line));

  const toggle = (line: number) =>
    setExcluded((s) => {
      const next = new Set(s);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });

  const togglePage = () =>
    setExcluded((s) => {
      const next = new Set(s);
      for (const r of allOnPage) {
        if (allOnPageChecked) next.add(r.line);
        else next.delete(r.line);
      }
      return next;
    });

  const submit = async () => {
    if (!chosenLevel) return setLevelError("Choose the level for these students.");
    if (!LEVEL_RE.test(chosenLevel)) return setLevelError("Use up to 20 letters or numbers, e.g. 300.");
    setLevelError(null);
    if (badNames.length) return toast.error("Some selected students have no name. Fix or untick them.");
    setSaving(true);
    try {
      const out = await api<BulkImportOut>("admin/students/bulk/rows", {
        json: {
          level: chosenLevel,
          filename: preview.filename,
          format: preview.format,
          rows: selected.map((r) => ({ line: r.line, identifier: r.identifier, full_name: nameOf(r).trim() })),
        },
      });
      toast.success(`${out.created.toLocaleString()} student${out.created === 1 ? "" : "s"} added to ${chosenLevel} level.`);
      onDone(out, chosenLevel);
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  };

  const fmt = FORMAT_INFO[preview.format];

  return (
    <div className="flex flex-col gap-4">
      {/* file summary */}
      <Card className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={clsx("flex size-11 shrink-0 items-center justify-center rounded-2xl text-[11px] font-extrabold", fmt.tone)}>{fmt.ext}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{preview.filename}</p>
              <p className="text-xs text-muted">
                {fmt.label} · <span className="num">{preview.rows.length.toLocaleString()}</span> students found
                {preview.counts.exists > 0 && (
                  <>
                    {" "}
                    · <span className="num">{preview.counts.exists.toLocaleString()}</span> already added are hidden
                  </>
                )}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} disabled={saving}>
            Choose a different file
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["new", "exists", "invalid"] as ImportRowStatus[]).map((k) => (
            <div key={k} className="rounded-2xl bg-subtle px-4 py-3">
              <p className="text-xs font-medium text-muted">{k === "new" ? "New students" : k === "exists" ? "Already in the system" : STATUS[k].label}</p>
              <p
                className={clsx(
                  "num text-2xl font-extrabold tracking-tight",
                  k === "new" && "text-primary",
                  k === "invalid" && preview.counts.invalid > 0 && "text-danger",
                )}
              >
                {(k === "exists" ? preview.counts.exists + preview.counts.duplicate : preview.counts[k]).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* level */}
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold tracking-tight">
            Which level are these students? <span className="text-danger">*</span>
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            Every student you import from this file gets this level.
            {preview.levels_in_file.length > 1 && <> The file mentions {preview.levels_in_file.join(", ")} — upload one level at a time.</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Level">
          {LEVELS.map((l) => {
            const on = !useCustom && level === l;
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setUseCustom(false);
                  setLevel(l);
                  setLevelError(null);
                }}
                className={clsx(
                  "num flex h-12 min-w-[76px] items-center justify-center gap-1.5 rounded-2xl px-4 text-[15px] font-extrabold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97]",
                  on ? "bg-primary text-primary-fg shadow-[0_8px_20px_-10px_var(--primary)]" : "bg-subtle text-foreground hover:bg-primary-soft",
                )}
              >
                {on && <IconCheck size={14} strokeWidth={3} />}
                {l}
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={useCustom}
            onClick={() => setUseCustom(true)}
            className={clsx(
              "flex h-12 items-center rounded-2xl px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              useCustom ? "bg-primary text-primary-fg" : "bg-subtle text-muted hover:bg-primary-soft",
            )}
          >
            Other
          </button>
          {useCustom && (
            <Input
              autoFocus
              aria-label="Custom level"
              placeholder="e.g. 700 or Spill-over"
              value={customLevel}
              maxLength={20}
              onChange={(e) => {
                setCustomLevel(e.target.value);
                setLevelError(null);
              }}
              className="!h-12 w-48"
            />
          )}
        </div>
        {levelError && <p className="text-xs font-medium text-danger" role="alert">{levelError}</p>}
      </Card>

      {/* rows */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold tracking-tight">New students to add</h2>
          {preview.counts.invalid > 0 && (
          <div className="flex rounded-xl bg-subtle p-1 text-[13px] font-semibold" role="tablist">
            {([
              ["new", `New ${preview.counts.new}`],
              ["invalid", `Can't read ${preview.counts.invalid}`],
            ] as [Filter, string][]).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filter === k}
                onClick={() => {
                  setFilter(k);
                  setPage(1);
                }}
                className={clsx("rounded-lg px-3 py-1.5 transition-colors", filter === k ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
          )}
        </div>

        {visible.length === 0 ? (
          <p className="rounded-2xl bg-subtle px-4 py-8 text-center text-sm text-muted">
            {filter === "new" ? "No new students in this file." : "Nothing here."}
          </p>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all ready students on this page"
                      className="size-4 accent-[var(--primary)]"
                      checked={allOnPageChecked}
                      disabled={allOnPage.length === 0}
                      onChange={togglePage}
                    />
                  </Th>
                  <Th>Matric / Reg no.</Th>
                  <Th>Full name</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const ready = r.status === "new";
                  const on = ready && !excluded.has(r.line);
                  return (
                    <tr key={r.line} className={clsx(!on && "text-muted")}>
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Import ${nameOf(r) || r.identifier}`}
                          className="size-4 accent-[var(--primary)]"
                          checked={on}
                          disabled={!ready}
                          onChange={() => toggle(r.line)}
                        />
                      </Td>
                      <Td className="font-mono text-xs">{r.identifier || "—"}</Td>
                      <Td>
                        {ready ? (
                          <Input
                            aria-label={`Full name for ${r.identifier}`}
                            value={nameOf(r)}
                            maxLength={120}
                            disabled={!on}
                            onChange={(e) => setNames((n) => ({ ...n, [r.line]: e.target.value }))}
                            className={clsx("!h-9 min-w-48", on && nameOf(r).trim().length < 2 && "border-danger")}
                          />
                        ) : (
                          <span>{r.full_name || "—"}</span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                        {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {visible.length > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={visible.length} onPage={setPage} />}
          </>
        )}
      </Card>

      {/* action bar */}
      <div className="surface sticky bottom-4 z-10 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="num font-extrabold">{selected.length.toLocaleString()}</span> of{" "}
          <span className="num">{selectable.length.toLocaleString()}</span> ready students selected
          {chosenLevel && (
            <>
              {" "}
              · Level <span className="num font-extrabold text-primary">{chosenLevel}</span>
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onBack} disabled={saving}>
            Back
          </Button>
          <Button onClick={submit} loading={saving} disabled={selected.length === 0}>
            <IconUsers size={16} />
            Import {selected.length.toLocaleString()} student{selected.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---- step 3: result -------------------------------------------------------------------------------

function ResultStep({ result, level, onAnother }: { result: BulkImportOut; level: string; onAnother: () => void }) {
  const downloadProblems = () => {
    const rows = [
      "line,identifier,problem",
      ...result.errors.map((e) => [e.line, e.identifier, e.error].map(csvCell).join(",")),
      ...result.skipped.map((s) => [s.line, s.identifier, s.reason].map(csvCell).join(",")),
    ];
    download("import-problems.csv", rows.join("\n") + "\n");
  };
  const problems = [
    ...result.errors.map((e) => ({ line: e.line, identifier: e.identifier, text: e.error })),
    ...result.skipped.map((s) => ({ line: s.line, identifier: s.identifier, text: s.reason })),
  ];

  return (
    <Card className="flex flex-col gap-6">
      <div className="animate-pop flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-fg shadow-[0_12px_28px_-10px_var(--primary)]">
          <IconCheck size={28} strokeWidth={3} />
        </span>
        <div>
          <p className="num text-3xl font-extrabold tracking-tight">{result.created.toLocaleString()}</p>
          <p className="text-sm text-muted">
            student{result.created === 1 ? "" : "s"} added to <span className="font-semibold text-foreground">{level} level</span>
          </p>
        </div>
      </div>

      {problems.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Not imported ({problems.length})</p>
            <Button variant="secondary" size="sm" onClick={downloadProblems}>
              Download as CSV
            </Button>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Line</Th>
                <Th>Identifier</Th>
                <Th>Reason</Th>
              </tr>
            </thead>
            <tbody>
              {problems.map((r) => (
                <tr key={`${r.line}-${r.identifier}`}>
                  <Td className="num">{r.line}</Td>
                  <Td className="font-mono text-xs">{r.identifier || "—"}</Td>
                  <Td>{r.text}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" onClick={onAnother}>
          <IconUpload size={16} /> Import another level
        </Button>
        <Link href="/admin/students" className={buttonClass("primary")}>
          View students
        </Link>
      </div>
    </Card>
  );
}
