"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ShareResultsCard } from "@/components/archives";
import { Countdown, ElectionTimes, ImagePicker, StateBadge } from "@/components/election";
import { ElectionForm, electionToForm } from "@/components/election-form";
import { useDebounced, useElection } from "@/components/staff";
import { IconChart, IconCheck, IconImage, IconLock, IconPencil, IconPlus, IconSearch, IconUpload, IconUsers, IconX } from "@/components/icons";
import { INITIAL_CROP, ImageAdjuster, cropImage, fileFromUrl, type CropState } from "@/components/image-adjuster";
import { buttonClass } from "@/components/styles";
import { Alert, Avatar, BackLink, Button, ConfirmDialog, Dialog, ErrorState, Input, PageSpinner, Panel, Spinner, TextField } from "@/components/ui";
import { api, type ApiOptions } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { CandidateOut, ElectionOut, MessageOut, Page, PositionOut, SessionStateOut, StudentOut } from "@/lib/api/types";
import { serverNow, toAwareISO } from "@/lib/time";
import { candidateNameSchema, check, checkImage, positionSchema } from "@/lib/validation";
import { focusFirstError } from "@/lib/focus-error";

export function ElectionBuilder({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: election, error, isPending, refetch } = useElection(id);
  const session = useQuery({ queryKey: ["session"], queryFn: () => api<SessionStateOut>("admin/session"), staleTime: 60_000 });
  const [confirm, setConfirm] = useState<"publish" | "unpublish" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishProblems, setPublishProblems] = useState<string[]>([]);

  /** Run a mutation that returns the updated election and write it into the cache. */
  const mutate = async (path: string, opts: ApiOptions, success?: string): Promise<boolean> => {
    try {
      const updated = await api<ElectionOut>(path, opts);
      queryClient.setQueryData(["election", id], updated);
      void queryClient.invalidateQueries({ queryKey: ["elections"] });
      if (success) toast.success(success);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.code === "ELECTION_LOCKED") void refetch();
      toast.error(errorMessage(err));
      return false;
    }
  };

  if (isPending) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const editable = election.state === "draft" || election.state === "upcoming";
  // Students already standing in this election (student id -> position name).
  const taken = new Map<string, string>();
  for (const p of election.positions) for (const c of p.candidates) if (c.student_id) taken.set(c.student_id, p.name);

  const problems = [
    election.positions.length === 0 && "Add at least one position.",
    ...election.positions.filter((p) => p.candidates.length === 0).map((p) => `Position “${p.name}” has no candidates.`),
    new Date(election.end_time).getTime() <= serverNow() && "The end time must be in the future.",
  ].filter(Boolean) as string[];

  const runConfirmed = async () => {
    if (!confirm) return;
    setBusy(true);
    if (confirm === "delete") {
      try {
        const res = await api<MessageOut>(`admin/elections/${id}`, { method: "DELETE" });
        toast.success(res.message);
        void queryClient.invalidateQueries({ queryKey: ["elections"] });
        router.push("/admin/elections");
        return;
      } catch (err) {
        toast.error(errorMessage(err));
      }
    } else if (confirm === "publish") {
      try {
        const updated = await api<ElectionOut>(`admin/elections/${id}/publish`, { method: "POST" });
        queryClient.setQueryData(["election", id], updated);
        void queryClient.invalidateQueries({ queryKey: ["elections"] });
        setPublishProblems([]);
        toast.success("Election published. Students can now see it.");
      } catch (err) {
        if (err instanceof ApiError && err.code === "ELECTION_INCOMPLETE" && Array.isArray(err.details)) {
          setPublishProblems(err.details as string[]);
        }
        toast.error(errorMessage(err));
      }
    } else {
      await mutate(`admin/elections/${id}/unpublish`, { method: "POST" }, "Election moved back to draft.");
    }
    setBusy(false);
    setConfirm(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/admin/elections">Elections</BackLink>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <StateBadge election={election} />
            <h1 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.02em]">{election.title}</h1>
            <div className="mt-4">
              <ElectionTimes election={election} />
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {(election.state === "ongoing" || election.state === "ended") && (
              <Link href={`/admin/elections/${id}/live`} className={buttonClass("ink")}>
                <IconChart size={16} />
                {election.state === "ongoing" ? "Live count" : "Results"}
              </Link>
            )}
            {election.state === "draft" && (
              <>
                <Button variant="secondary" className="text-danger" onClick={() => setConfirm("delete")}>
                  Delete
                </Button>
                <Button onClick={() => setConfirm("publish")} disabled={problems.length > 0}>
                  Publish
                </Button>
              </>
            )}
            {election.state === "upcoming" && (
              <Button variant="secondary" onClick={() => setConfirm("unpublish")}>
                Unpublish
              </Button>
            )}
          </div>
        </div>
      </div>

      {(election.state === "draft" || election.state === "upcoming") && session.data && session.data.paid_students === 0 && (
        <Alert tone="warning" title="No student is marked as paid yet">
          Only paid students can vote, so nobody could vote in this election right now.{" "}
          <Link href="/admin/students/paid" className="font-semibold underline">
            Import the paid list
          </Link>
        </Alert>
      )}
      {election.state === "ongoing" && (
        <Alert tone="warning" title="Voting is in progress">
          The election can no longer be edited. Only the super admin can stop it.
        </Alert>
      )}
      {election.state === "ended" && (
        <>
          <Alert tone="info" title="This election has ended">
            It can no longer be edited. It is also kept in the{" "}
            <Link href={`/admin/archives/${id}`} className="font-semibold underline">
              archives
            </Link>
            .
          </Alert>
          <ShareResultsCard election={election} />
        </>
      )}
      {election.state === "upcoming" && (
        <section className="flex flex-col gap-6 surface p-6 sm:flex-row sm:items-end sm:justify-between">
          <Countdown to={election.start_time} label="Voting opens in" onDone={() => setTimeout(() => void refetch(), 1500)} />
          <p className="max-w-xs text-sm leading-relaxed text-muted">
            Students can already see the candidates. Edits and unpublishing lock when voting opens.
          </p>
        </section>
      )}
      {election.state === "draft" && (
        <section className="surface">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Ready to publish?</h2>
            <span className="num text-xs text-muted">
              {problems.length === 0 && publishProblems.length === 0 ? "All checks pass" : `${new Set([...problems, ...publishProblems]).size} to fix`}
            </span>
          </header>
          <ul className="flex flex-col gap-2 px-5 py-4 text-sm">
            {problems.length === 0 && publishProblems.length === 0 ? (
              <li className="flex items-center gap-2.5 text-primary">
                <IconCheck size={16} strokeWidth={2.25} /> Every position has candidates and the end time is in the future.
              </li>
            ) : (
              [...new Set([...problems, ...publishProblems])].map((p) => (
                <li key={p} className="flex items-center gap-2.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                  {p}
                </li>
              ))
            )}
          </ul>
        </section>
      )}

      <Panel title="Details" actions={!editable && <IconLock size={15} className="text-muted" />}>
        <ElectionForm
          key={election.id + election.start_time + election.end_time + election.title + election.auto_share_results}
          initial={electionToForm(election)}
          submitLabel="Save details"
          disabled={!editable}
          onSubmit={async (v) => {
            const before = electionToForm(election);
            const changes: Record<string, string | boolean | null> = {};
            if (v.title.trim() !== before.title) changes.title = v.title.trim();
            if (v.description.trim() !== before.description) changes.description = v.description.trim() || null;
            if (v.start_time !== before.start_time) changes.start_time = toAwareISO(v.start_time);
            if (v.end_time !== before.end_time) changes.end_time = toAwareISO(v.end_time);
            if (v.auto_share_results !== before.auto_share_results) changes.auto_share_results = v.auto_share_results;
            if (Object.keys(changes).length === 0) {
              toast.message("Nothing to save.");
              return;
            }
            const updated = await api<ElectionOut>(`admin/elections/${id}`, { method: "PATCH", json: changes });
            queryClient.setQueryData(["election", id], updated);
            void queryClient.invalidateQueries({ queryKey: ["elections"] });
            toast.success("Details saved.");
          }}
        />
      </Panel>

      <section className="flex flex-col gap-4">
        <div className="mt-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">Ballot</h2>
          <p className="num text-xs text-muted">
            {election.positions.length} positions · {election.positions.reduce((n, p) => n + p.candidates.length, 0)} candidates
          </p>
        </div>
        {election.positions.map((p, i) => (
          <PositionCard key={p.id} index={i} electionId={id} position={p} editable={editable} mutate={mutate} taken={taken} />
        ))}
        {editable && <AddPosition electionId={id} mutate={mutate} />}
        {!editable && election.positions.length === 0 && <p className="text-sm text-muted">No positions.</p>}
      </section>

      <ConfirmDialog
        open={confirm === "publish"}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmed}
        loading={busy}
        title="Publish election?"
        confirmLabel="Publish"
      >
        Students will see this election and its candidates straight away. Voting opens automatically at the start time. You can unpublish or
        edit it until then.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "unpublish"}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmed}
        loading={busy}
        title="Unpublish election?"
        confirmLabel="Unpublish"
      >
        The election goes back to draft and students will no longer see it.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirmed}
        loading={busy}
        danger
        title="Delete draft?"
        confirmLabel="Delete"
      >
        “{election.title}”, its positions and candidate photos will be deleted permanently.
      </ConfirmDialog>
    </div>
  );
}

type Mutate = (path: string, opts: ApiOptions, success?: string) => Promise<boolean>;

function AddPosition({ electionId, mutate }: { electionId: string; mutate: Mutate }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const result = check(positionSchema, { name });
    setError(result.errors?.name ?? null);
    if (!result.data) return focusFirstError();
    setLoading(true);
    if (await mutate(`admin/elections/${electionId}/positions`, { json: { name: result.data.name } }, "Position added.")) setName("");
    setLoading(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-xl border border-dashed border-border-strong p-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input
          placeholder="Add a position, e.g. President"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Position name"
          aria-invalid={error ? true : undefined}
          className="border-transparent bg-transparent hover:border-transparent focus:border-primary"
        />
        {error && <p className="mt-1 px-3 text-xs font-medium text-danger">{error}</p>}
      </div>
      <Button type="submit" variant="secondary" loading={loading}>
        <IconPlus size={15} /> Add position
      </Button>
    </form>
  );
}

function PositionCard({
  index,
  electionId,
  position,
  editable,
  mutate,
  taken,
}: {
  index: number;
  electionId: string;
  position: PositionOut;
  editable: boolean;
  mutate: Mutate;
  taken: Map<string, string>;
}) {
  const base = `admin/elections/${electionId}/positions/${position.id}`;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(position.name);
  const [adding, setAdding] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<CandidateOut | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rename = async (e: FormEvent) => {
    e.preventDefault();
    const result = check(positionSchema, { name });
    if (!result.data) {
      toast.error(result.errors?.name ?? "Invalid name.");
      return;
    }
    setBusy(true);
    if (await mutate(base, { method: "PATCH", json: { name: result.data.name } }, "Position renamed.")) setRenaming(false);
    setBusy(false);
  };

  return (
    <section className="surface">
      <header className="flex min-h-13 flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-2.5">
        {renaming ? (
          <form onSubmit={rename} className="flex flex-1 gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Position name" autoFocus className="h-8" />
            <Button type="submit" size="sm" loading={busy}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <h3 className="flex items-baseline gap-3 text-[15px] font-semibold">
            <span className="num text-sm font-normal text-muted">{String(index + 1).padStart(2, "0")}</span>
            {position.name}
            <span className="num text-xs font-normal text-muted">{position.candidates.length}</span>
          </h3>
        )}
        {editable && !renaming && (
          <div className="flex gap-0.5">
            <Button variant="ghost" size="sm" onClick={() => setRenaming(true)}>
              Rename
            </Button>
            <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        )}
      </header>

      <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-6">
        {position.candidates.map((c) => (
          <div key={c.id} className="group relative overflow-hidden rounded-lg border border-border">
            <div className="aspect-square bg-subtle">
              {c.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image_url} alt={c.full_name} className="size-full object-cover" loading="lazy" />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Avatar name={c.full_name} size={56} />
                </div>
              )}
            </div>
            <p className="truncate px-3 pt-2 text-[13px] font-medium">{c.full_name}</p>
            <p className="truncate px-3 pb-2 text-[11px] text-muted">{c.student_id ? `${c.level ? `${c.level} level · ` : ""}Student` : "\u00a0"}</p>
            {editable && (
              <div className="absolute right-2 top-2 flex gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button
                  type="button"
                  aria-label={`Edit ${c.full_name}`}
                  title="Edit"
                  onClick={() => setEditingCandidate(c)}
                  className="flex size-7 items-center justify-center rounded-full bg-card/95 text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-primary hover:text-primary-fg"
                >
                  <IconPencil size={13} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${c.full_name}`}
                  title="Remove"
                  disabled={removing === c.id}
                  onClick={async () => {
                    setRemoving(c.id);
                    await mutate(`${base}/candidates/${c.id}`, { method: "DELETE" }, "Candidate removed.");
                    setRemoving(null);
                  }}
                  className="flex size-7 items-center justify-center rounded-full bg-card/95 text-danger shadow-sm ring-1 ring-border transition-colors hover:bg-danger hover:text-white"
                >
                  {removing === c.id ? <Spinner className="size-3.5" /> : <IconX size={14} />}
                </button>
              </div>
            )}
          </div>
        ))}
        {editable && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-[13px] font-medium text-muted transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary"
          >
            <IconPlus size={18} />
            Add candidate
          </button>
        )}
        {!editable && position.candidates.length === 0 && <p className="text-sm text-muted">No candidates.</p>}
      </div>

      {adding && <CandidateDialog base={base} positionName={position.name} onClose={() => setAdding(false)} mutate={mutate} taken={taken} />}
      {editingCandidate && (
        <CandidateDialog
          key={editingCandidate.id}
          base={base}
          positionName={position.name}
          candidate={editingCandidate}
          onClose={() => setEditingCandidate(null)}
          mutate={mutate}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        loading={busy}
        danger
        title={`Delete “${position.name}”?`}
        confirmLabel="Delete position"
        onConfirm={async () => {
          setBusy(true);
          await mutate(base, { method: "DELETE" }, "Position deleted.");
          setBusy(false);
          setConfirmDelete(false);
        }}
      >
        The position and its {position.candidates.length} candidate(s) will be removed.
      </ConfirmDialog>
    </section>
  );
}

function CandidateDialog({
  base,
  positionName,
  candidate,
  onClose,
  mutate,
  taken,
}: {
  base: string;
  positionName: string;
  /** Present when editing an existing candidate. */
  candidate?: CandidateOut;
  onClose: () => void;
  mutate: Mutate;
  taken?: Map<string, string>;
}) {
  const editing = !!candidate;
  const [source, setSource] = useState<"student" | "manual">("student");
  const [student, setStudent] = useState<StudentOut | null>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const fromStudent = !editing && source === "student";
  const [fullName, setFullName] = useState(candidate?.full_name ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<CropState>(INITIAL_CROP);
  const [errors, setErrors] = useState<{ full_name?: string; image?: string | null }>({});
  const [loading, setLoading] = useState(false);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const choose = (f: File | null | undefined) => {
    if (!f) return;
    const problem = checkImage(f);
    setErrors((e) => ({ ...e, image: problem }));
    if (!problem) {
      setFile(f);
      setCrop(INITIAL_CROP);
    }
  };

  const adjustCurrent = async () => {
    if (!candidate?.image_url) return;
    setLoadingCurrent(true);
    try {
      choose(await fileFromUrl(candidate.image_url, `${candidate.full_name}.jpg`));
    } catch (err) {
      setErrors((e) => ({ ...e, image: errorMessage(err) }));
    } finally {
      setLoadingCurrent(false);
    }
  };

  const takeProfilePhoto = async () => {
    if (!student?.profile_picture_url) return;
    setLoadingProfile(true);
    try {
      choose(await fileFromUrl(student.profile_picture_url, `${student.full_name}.jpg`));
    } catch (err) {
      setErrors((e) => ({ ...e, image: errorMessage(err) }));
    } finally {
      setLoadingProfile(false);
    }
  };

  const save = async () => {
    const needsPhoto = !editing && !file;
    if (fromStudent) {
      setStudentError(student ? null : "Choose a student from the list.");
      setErrors({ image: needsPhoto ? "Upload a photo of the candidate." : null });
      if (!student || needsPhoto) return focusFirstError();
      setLoading(true);
      try {
        const form = new FormData();
        form.append("student_id", student.id);
        form.append("image", await cropImage(file!, crop));
        if (await mutate(`${base}/candidates`, { form }, `${student.full_name} added.`)) onClose();
      } catch (err) {
        setErrors((e) => ({ ...e, image: errorMessage(err) }));
      } finally {
        setLoading(false);
      }
      return;
    }

    const result = check(candidateNameSchema, { full_name: fullName });
    setErrors({ full_name: result.errors?.full_name, image: needsPhoto ? "Choose a photo of the candidate." : null });
    if (!result.data || needsPhoto) return focusFirstError();

    const nameChanged = !editing || result.data.full_name !== candidate.full_name;
    if (editing && !nameChanged && !file) {
      toast.message("Nothing to change.");
      onClose();
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      if (nameChanged) form.append("full_name", result.data.full_name);
      if (file) form.append("image", await cropImage(file, crop));
      const ok = editing
        ? await mutate(`${base}/candidates/${candidate.id}`, { method: "PATCH", form }, "Candidate updated.")
        : await mutate(`${base}/candidates`, { form }, "Candidate added.");
      if (ok) onClose();
    } catch (err) {
      setErrors((e) => ({ ...e, image: errorMessage(err) }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!loading}
      title={editing ? "Edit candidate" : "Add candidate"}
      description={positionName}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={save} loading={loading}>
            {editing ? "Save changes" : "Add candidate"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!editing && (
          <div className="grid grid-cols-2 rounded-xl bg-subtle p-1 text-[13px] font-semibold" role="tablist" aria-label="How to add the candidate">
            {([
              ["student", "From student list"],
              ["manual", "Type a name"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={source === key}
                onClick={() => setSource(key)}
                className={clsx(
                  "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition-colors",
                  source === key ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground",
                )}
              >
                {key === "student" ? <IconUsers size={15} /> : <IconPencil size={14} />}
                {label}
              </button>
            ))}
          </div>
        )}

        {fromStudent ? (
          <div className="flex flex-col gap-1.5" aria-invalid={studentError ? true : undefined}>
            <p className="text-[13px] font-medium">
              Student <span className="text-danger">*</span>
            </p>
            {student ? (
              <div className="flex items-center gap-3 rounded-2xl bg-primary-soft p-3">
                <Avatar src={student.profile_picture_url} name={student.full_name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{student.full_name}</p>
                  <p className="truncate text-xs text-muted">
                    <span className="font-mono">{student.identifier}</span> · {student.level} level
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStudent(null);
                    setFile(null);
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <StudentPicker
                taken={taken}
                onPick={(s) => {
                  setStudent(s);
                  setStudentError(null);
                }}
              />
            )}
            {studentError && (
              <p role="alert" className="text-xs font-medium text-danger">
                {studentError}
              </p>
            )}
          </div>
        ) : (
          <TextField label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.full_name} autoFocus />
        )}

        <div className="flex flex-col gap-2" aria-invalid={errors.image ? true : undefined}>
          <p className="text-[13px] font-medium">Photo</p>
          {file ? (
            <>
              <ImageAdjuster key={`${file.name}-${file.size}-${file.lastModified}`} file={file} value={crop} onChange={setCrop} />
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                  Choose a different photo
                </Button>
                {editing && (
                  <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                    Keep current photo
                  </Button>
                )}
              </div>
            </>
          ) : editing ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-subtle p-4 sm:flex-row">
              <Avatar src={candidate.image_url} name={candidate.full_name} size={88} className="rounded-2xl" />
              <div className="flex flex-1 flex-col items-center gap-2 sm:items-start">
                <p className="text-xs text-muted">Current photo</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {candidate.image_url && (
                    <Button variant="secondary" size="sm" onClick={() => void adjustCurrent()} loading={loadingCurrent}>
                      Adjust current photo
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                    <IconUpload size={14} /> Upload new photo
                  </Button>
                </div>
              </div>
            </div>
          ) : fromStudent && !student ? (
            <p className="rounded-2xl bg-subtle px-4 py-6 text-center text-xs text-muted">Choose a student first, then upload their photo.</p>
          ) : (
            <>
              <ImagePicker file={null} error={null} label="Choose photo" onChange={(f, problem) => (problem ? setErrors((e) => ({ ...e, image: problem })) : choose(f))} />
              {fromStudent && student?.profile_picture_url && (
                <div className="flex justify-center">
                  <Button variant="secondary" size="sm" onClick={() => void takeProfilePhoto()} loading={loadingProfile}>
                    <IconImage size={14} /> Use their profile picture
                  </Button>
                </div>
              )}
            </>
          )}
          {errors.image && (
            <p role="alert" className="text-center text-xs font-medium text-danger">
              {errors.image}
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </Dialog>
  );
}

/** Search the student list and pick one. Students already standing in this election can't be picked. */
function StudentPicker({ taken, onPick }: { taken?: Map<string, string>; onPick: (s: StudentOut) => void }) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search, 250);
  const { data, isFetching, error } = useQuery({
    queryKey: ["students", "candidate-picker", q],
    queryFn: () => api<Page<StudentOut>>("admin/students", { query: { search: q.trim() || undefined, page_size: 8, sort: "name_asc" } }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="relative border-b border-border">
        <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or Matric/Reg no."
          aria-label="Search students"
          className="h-11 w-full bg-card pl-10 pr-10 text-sm outline-none placeholder:text-muted/80"
        />
        {isFetching && <Spinner className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />}
      </div>
      <ul className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label="Students">
        {error ? (
          <li className="px-3 py-4 text-center text-xs text-danger">{errorMessage(error)}</li>
        ) : !data ? (
          <li className="px-3 py-6 text-center text-xs text-muted">Loading students…</li>
        ) : data.items.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-muted">No students match “{q}”.</li>
        ) : (
          data.items.map((s) => {
            const standing = taken?.get(s.id);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  disabled={!!standing}
                  onClick={() => onPick(s)}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Avatar src={s.profile_picture_url} name={s.full_name} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.full_name}</span>
                    <span className="block truncate text-xs text-muted">
                      <span className="font-mono">{s.identifier}</span> · {s.level} level
                    </span>
                  </span>
                  {standing && <span className="shrink-0 text-[11px] font-semibold text-muted">Standing for {standing}</span>}
                </button>
              </li>
            );
          })
        )}
      </ul>
      {data && data.total > data.items.length && (
        <p className="border-t border-border px-3 py-2 text-[11px] text-muted">
          Showing {data.items.length} of {data.total.toLocaleString()} — type to narrow it down.
        </p>
      )}
    </div>
  );
}
