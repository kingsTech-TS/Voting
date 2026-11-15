"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { IconFile, IconUpload } from "@/components/icons";
import { Alert, BackLink, Button, Card, PageHeader, Table, Td, Th } from "@/components/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { BulkImportOut } from "@/lib/api/types";
import { MAX_CSV_BYTES } from "@/lib/validation";

const TEMPLATE = "identifier,full_name,level\n220703012,Jane Doe,300\n202650372846LA,John Smith,100\n";

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

/** Minimal CSV line split (handles quoted fields) — only used for the preview. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function ImportStudents() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkImportOut | null>(null);

  const pick = async (f: File | undefined | null) => {
    setResult(null);
    if (!f) return;
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") {
      setProblem("Choose a .csv file.");
      return;
    }
    if (f.size > MAX_CSV_BYTES) {
      setProblem("CSV files must be at most 2 MB.");
      return;
    }
    const text = await f.text();
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    const header = splitCsvLine(lines[0] ?? "").map((h) => h.trim().toLowerCase());
    if (!["identifier", "full_name", "level"].every((c) => header.includes(c))) {
      setProblem("The CSV must have the columns: identifier, full_name, level.");
      setFile(null);
      setPreview([]);
      return;
    }
    setProblem(null);
    setFile(f);
    setPreview(lines.slice(0, 11).map(splitCsvLine));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    void pick(e.dataTransfer.files?.[0]);
  };

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api<BulkImportOut>("admin/students/bulk", { form });
      setResult(res);
      toast.success(`${res.created} student${res.created === 1 ? "" : "s"} added.`);
      void queryClient.invalidateQueries({ queryKey: ["students"] });
      setFile(null);
      setPreview([]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const downloadProblems = () => {
    if (!result) return;
    const rows = [
      "line,identifier,problem",
      ...result.errors.map((e) => [e.line, e.identifier, e.error].map(csvCell).join(",")),
      ...result.skipped.map((s) => [s.line, s.identifier, s.reason].map(csvCell).join(",")),
    ];
    download("import-problems.csv", rows.join("\n") + "\n");
  };

  return (
    <>
      <BackLink href="/admin/students">Students</BackLink>
      <PageHeader
        title="Import students"
        description={
          <>
            A CSV with the columns <code className="num rounded bg-subtle px-1.5 py-0.5 text-[12px] text-foreground">identifier, full_name, level</code>.
            UTF-8, up to 2 MB. Existing students are skipped, not overwritten.
          </>
        }
        actions={
          <Button variant="secondary" onClick={() => download("students-template.csv", TEMPLATE)}>
            <IconFile size={16} /> Download template
          </Button>
        }
      />

      <Card className="flex flex-col gap-4">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong bg-subtle/40 px-6 py-12 text-center"
        >
          <span className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted">
            {file ? <IconFile size={20} /> : <IconUpload size={20} />}
          </span>
          {file ? (
            <p className="text-sm">
              <span className="font-medium">{file.name}</span>{" "}
              <span className="num text-muted">· {(file.size / 1024).toFixed(1)} KB</span>
            </p>
          ) : (
            <p className="text-sm text-muted">Drop a CSV file here, or</p>
          )}
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            {file ? "Choose another file" : "Browse files"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {problem && <Alert tone="danger">{problem}</Alert>}

        {preview.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Preview (first {Math.min(10, preview.length - 1)} rows)</p>
            <Table>
              <thead>
                <tr>
                  {preview[0].map((h, i) => (
                    <Th key={i}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.slice(1).map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <Td key={j}>{cell}</Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={upload} loading={loading} disabled={!file}>
            Import students
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Import result</h2>
            {(result.errors.length > 0 || result.skipped.length > 0) && (
              <Button variant="secondary" size="sm" onClick={downloadProblems}>
                Download problems as CSV
              </Button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-primary-soft p-3">
              <p className="text-2xl font-semibold text-primary">{result.created}</p>
              <p className="text-xs text-muted">Added</p>
            </div>
            <div className="rounded-xl bg-warning-soft p-3">
              <p className="text-2xl font-semibold text-warning">{result.skipped.length}</p>
              <p className="text-xs text-muted">Skipped</p>
            </div>
            <div className="rounded-xl bg-danger-soft p-3">
              <p className="text-2xl font-semibold text-danger">{result.errors.length}</p>
              <p className="text-xs text-muted">Errors</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <ProblemTable title="Errors (not imported)" rows={result.errors.map((e) => ({ line: e.line, identifier: e.identifier, text: e.error }))} />
          )}
          {result.skipped.length > 0 && (
            <ProblemTable title="Skipped" rows={result.skipped.map((s) => ({ line: s.line, identifier: s.identifier, text: s.reason }))} />
          )}
        </Card>
      )}
    </>
  );
}

function ProblemTable({ title, rows }: { title: string; rows: { line: number; identifier: string; text: string }[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <Table>
        <thead>
          <tr>
            <Th>Line</Th>
            <Th>Identifier</Th>
            <Th>Problem</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.line}-${r.identifier}`}>
              <Td>{r.line}</Td>
              <Td className="font-mono text-xs">{r.identifier || "—"}</Td>
              <Td>{r.text}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
