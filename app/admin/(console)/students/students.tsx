"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { IconCheck, IconPlus, IconUpload } from "@/components/icons";
import { StudentsTable } from "@/components/staff";
import { buttonClass } from "@/components/styles";
import { Alert, Button, ConfirmDialog, Dialog, PageHeader, SelectField, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { MessageOut, SessionStateOut, StudentBulkDeleteOut, StudentOut } from "@/lib/api/types";
import {
  IDENTIFIER_HINT,
  STUDENT_LEVELS,
  check,
  normalizeIdentifier,
  studentCreateSchema,
  studentUpdateSchema,
  type FieldErrors,
} from "@/lib/validation";
import { focusFirstError } from "@/lib/focus-error";

type Pending = { kind: "edit" | "delete"; student: StudentOut } | null;

/** How long a deleted row takes to slide out (matches .animate-row-out). */
const ROW_OUT_MS = 450;
/** How long a new student is marked as new: covers the refetch, then the row animates once on mount. */
const ROW_NEW_MS = 4000;

/** Rows to animate: students just added (slide in) and just deleted (slide out). */
function useRowAnimations(invalidate: () => Promise<unknown>) {
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const markNew = useCallback((id: string) => {
    setFresh((s) => new Set(s).add(id));
    timers.current.push(
      setTimeout(
        () =>
          setFresh((s) => {
            const next = new Set(s);
            next.delete(id);
            return next;
          }),
        ROW_NEW_MS,
      ),
    );
  }, []);

  /** Play the slide-out on these rows, then refresh the list (which removes them). */
  const removeRows = useCallback(
    async (ids: string[]) => {
      if (ids.length) {
        setLeaving(new Set(ids));
        await new Promise((r) => timers.current.push(setTimeout(r, ROW_OUT_MS)));
      }
      await invalidate();
      setLeaving(new Set());
    },
    [invalidate],
  );

  const rowState = (s: StudentOut) => (leaving.has(s.id) ? "leaving" : fresh.has(s.id) ? "new" : undefined);
  return { markNew, removeRows, rowState };
}
type BulkPending = { students: StudentOut[]; clear: () => void } | null;

export function AdminStudents() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState<BulkPending>(null);
  const session = useQuery({ queryKey: ["session"], queryFn: () => api<SessionStateOut>("admin/session") });
  const firstYear = session.data?.levels.find((l) => l.level === "100")?.count;

  const invalidate = useCallback(() => queryClient.invalidateQueries({ queryKey: ["students"] }), [queryClient]);
  const rows = useRowAnimations(invalidate);

  const markPaid = async (students: StudentOut[], paid: boolean, clear: () => void) => {
    setBusy(true);
    try {
      const res = await api<{ updated: number }>("admin/students/paid", { json: { ids: students.map((s) => s.id), paid } });
      toast.success(`${res.updated.toLocaleString()} student${res.updated === 1 ? "" : "s"} marked as ${paid ? "paid" : "not paid"}.`);
      clear();
      void invalidate();
      void queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const runBulkDelete = async () => {
    if (!bulk) return;
    setBusy(true);
    try {
      const res = await api<StudentBulkDeleteOut>("admin/students/bulk-delete", { json: { ids: bulk.students.map((s) => s.id) } });
      toast.success(`${res.deleted.toLocaleString()} student${res.deleted === 1 ? "" : "s"} deleted.`);
      if (res.blocked.length) {
        toast.warning(`${res.blocked.length} not deleted: they voted in the election that is open now.`);
      }
      bulk.clear();
      setBulk(null);
      const blocked = new Set(res.blocked.map((b) => b.id));
      void rows.removeRows(bulk.students.map((s) => s.id).filter((id) => !blocked.has(id)));
      void queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const runAction = async () => {
    if (!pending || pending.kind === "edit") return;
    setBusy(true);
    try {
      const res = await api<MessageOut>(`admin/students/${pending.student.id}`, { method: "DELETE" });
      toast.success(res.message);
      setPending(null);
      void rows.removeRows([pending.student.id]);
      void queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Students"
        description="Only students on this list can register and vote."
        actions={
          <>
            <Link href="/admin/students/import" className={buttonClass("secondary")}>
              <IconUpload size={16} /> Import list
            </Link>
            <Link href="/admin/students/paid" className={buttonClass("secondary")}>
              <IconCheck size={16} /> Import paid list
            </Link>
            <Button variant="ink" onClick={() => setAdding(true)}>
              <IconPlus size={16} /> Add student
            </Button>
          </>
        }
      />
      {session.data && session.data.total_students > 0 && session.data.paid_students === 0 && (
        <Alert tone="warning" title="No student is marked as paid" className="mb-4">
          Only paid students can vote. Import the list of students who have paid their dues.{" "}
          <Link href="/admin/students/paid" className="font-semibold underline">
            Import paid list
          </Link>
        </Alert>
      )}
      {session.data?.current && firstYear === 0 && (
        <Alert tone="info" title={`Session ${session.data.current}: no 100 level students yet`} className="mb-4">
          Everyone has moved up a level for the new session. Import the new 100 level list to let them register and vote.{" "}
          <Link href="/admin/students/import?level=100" className="font-semibold underline">
            Import 100 level
          </Link>
        </Alert>
      )}
      <StudentsTable
        endpoint="admin/students"
        rowState={rows.rowState}
        bulkActions={(students, clear) => (
          <>
            <Button variant="secondary" size="sm" onClick={() => void markPaid(students, true, clear)} disabled={busy}>
              <IconCheck size={14} /> Mark as paid
            </Button>
            <Button variant="ghost" size="sm" onClick={() => void markPaid(students, false, clear)} disabled={busy}>
              Mark as not paid
            </Button>
            <Button variant="danger" size="sm" onClick={() => setBulk({ students, clear })}>
              Delete {students.length.toLocaleString()} student{students.length === 1 ? "" : "s"}
            </Button>
          </>
        )}
        actions={(s) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPending({ kind: "edit", student: s })}>
              Edit
            </Button>
            <Button variant="ghost" size="sm" className="text-danger" onClick={() => setPending({ kind: "delete", student: s })}>
              Delete
            </Button>
          </div>
        )}
      />

      <AddStudentDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(s) => {
          if (s) rows.markNew(s.id);
          void invalidate();
          void queryClient.invalidateQueries({ queryKey: ["session"] });
        }}
      />
      {pending?.kind === "edit" && (
        <EditStudentDialog student={pending.student} onClose={() => setPending(null)} onSaved={() => void invalidate()} />
      )}
      <ConfirmDialog
        open={pending?.kind === "delete"}
        onClose={() => setPending(null)}
        onConfirm={runAction}
        loading={busy}
        danger
        title="Delete student?"
        confirmLabel="Delete permanently"
      >
        <span className="font-semibold text-foreground">{pending?.student.full_name}</span> ({pending?.student.identifier}) and
        everything about them — account, email, password, sessions and profile picture — will be deleted. This can&apos;t be undone.
        Votes they already cast stay in past results but are no longer linked to them.
      </ConfirmDialog>
      <ConfirmDialog
        open={bulk !== null}
        onClose={() => setBulk(null)}
        onConfirm={runBulkDelete}
        loading={busy}
        danger
        title={`Delete ${bulk?.students.length.toLocaleString() ?? 0} students?`}
        confirmLabel="Delete permanently"
      >
        Their accounts, emails, passwords, sessions and profile pictures will be deleted. This can&apos;t be undone.
        {bulk && bulk.students.length <= 8 && (
          <ul className="mt-3 flex flex-col gap-1 rounded-xl bg-subtle px-3 py-2 text-[13px] text-foreground">
            {bulk.students.map((s) => (
              <li key={s.id}>
                {s.full_name} <span className="font-mono text-xs text-muted">{s.identifier}</span>
              </li>
            ))}
          </ul>
        )}
      </ConfirmDialog>
    </>
  );
}

type AddTab = "student" | "paid";

function AddStudentDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (added?: StudentOut) => void }) {
  const empty = { identifier: "", full_name: "", email: "", level: "" };
  const [tab, setTab] = useState<AddTab>("student");
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  // In the "Paid student" tab: the number is already on the list, offer to mark that student as paid.
  const [existing, setExisting] = useState<string | null>(null);
  // "Save and add another": a chip confirms each student added while the dialog stays open.
  const [lastAdded, setLastAdded] = useState<StudentOut | null>(null);
  const paid = tab === "paid";

  const switchTab = (t: AddTab) => {
    setTab(t);
    setExisting(null);
    setErrors({});
  };

  const submit = async (e: FormEvent, addAnother: boolean) => {
    e.preventDefault();
    const result = check(studentCreateSchema, values);
    setErrors(result.errors ?? {});
    setExisting(null);
    if (!result.data) return focusFirstError();
    setLoading(true);
    try {
      const s = await api<StudentOut>("admin/students", {
        json: {
          identifier: normalizeIdentifier(values.identifier),
          full_name: values.full_name.trim(),
          email: values.email.trim().toLowerCase(),
          level: values.level.trim(),
          paid,
        },
      });
      toast.success(paid ? `${s.full_name} added and marked as paid.` : `${s.full_name} added.`);
      onSaved(s);
      setLastAdded(addAnother ? s : null);
      setValues(addAnother ? { ...empty, level: values.level } : empty);
      if (!addAnother) onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "STUDENT_EXISTS" && paid) {
        setExisting(normalizeIdentifier(values.identifier));
      } else if (err instanceof ApiError && (err.code === "STUDENT_EXISTS" || err.field === "identifier")) {
        setErrors({ identifier: err.message });
        focusFirstError();
      } else if (err instanceof ApiError && (err.code === "EMAIL_IN_USE" || err.field === "email")) {
        setErrors({ email: err.message });
        focusFirstError();
      } else toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const markExistingPaid = async () => {
    if (!existing) return;
    setLoading(true);
    try {
      const res = await api<{ marked: number; already_paid: number }>("admin/students/paid/confirm", { json: { identifiers: [existing] } });
      toast.success(res.marked ? `${existing} marked as paid.` : `${existing} was already marked as paid.`);
      onSaved();
      setExisting(null);
      setValues(empty);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add student"
      footer={
        <>
          <Button variant="secondary" onClick={(e) => void submit(e, true)} loading={loading}>
            Save and add another
          </Button>
          <Button onClick={(e) => void submit(e, false)} loading={loading}>
            {paid ? "Save as paid" : "Save"}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e, false)} noValidate>
        {lastAdded && (
          <p
            key={lastAdded.id}
            role="status"
            className="animate-pop flex items-center gap-2 self-start rounded-full bg-primary-soft py-1 pl-1 pr-3 text-xs font-semibold text-primary"
          >
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-fg">
              <IconCheck size={11} strokeWidth={3} />
            </span>
            {lastAdded.full_name} added
          </p>
        )}
        <div className="grid grid-cols-2 rounded-xl bg-subtle p-1 text-[13px] font-semibold" role="tablist" aria-label="Type of student">
          {([
            ["student", "Student"],
            ["paid", "Paid student"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => switchTab(key)}
              className={
                tab === key
                  ? "flex items-center justify-center gap-1.5 rounded-lg bg-card px-3 py-2 text-foreground shadow-sm"
                  : "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-muted transition-colors hover:text-foreground"
              }
            >
              {key === "paid" && <IconCheck size={14} strokeWidth={2.5} className={tab === key ? "text-primary" : undefined} />}
              {label}
            </button>
          ))}
        </div>
        {paid ? (
          <p className="rounded-xl bg-primary-soft px-3.5 py-2.5 text-xs leading-relaxed text-foreground/80">
            The student is added <span className="font-semibold text-primary">already marked as paid</span>, so they can vote. Use this for
            students who paid but aren&apos;t on the student list yet.
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-muted">The student is added as not paid. Mark them paid later, or import the paid list.</p>
        )}
        <TextField
          label="Matric / Registration number"
          value={values.identifier}
          onChange={(e) => {
            setValues((v) => ({ ...v, identifier: e.target.value }));
            setExisting(null);
          }}
          onBlur={() => setValues((v) => ({ ...v, identifier: normalizeIdentifier(v.identifier) }))}
          error={errors.identifier}
          hint={IDENTIFIER_HINT}
        />
        {existing && (
          <Alert tone="info" title="This student is already on the list">
            <span className="flex flex-wrap items-center gap-2">
              Mark <span className="font-mono">{existing}</span> as paid instead?
              <Button size="sm" onClick={() => void markExistingPaid()} loading={loading}>
                <IconCheck size={14} /> Mark as paid
              </Button>
            </span>
          </Alert>
        )}
        <TextField
          label="Full name"
          value={values.full_name}
          onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))}
          error={errors.full_name}
        />
        <TextField
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="student@example.com"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          error={errors.email}
          hint="The student's registration code is sent here, so only they can claim the account."
        />
        <LevelField value={values.level} onChange={(level) => setValues((v) => ({ ...v, level }))} error={errors.level} />
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

/** Level picker: 100-600. A student already in another level (e.g. "Spill-over") keeps it as an option,
 * so opening the edit dialog never changes their level by accident. */
function LevelField({
  value,
  current,
  onChange,
  error,
}: {
  value: string;
  current?: string;
  onChange: (level: string) => void;
  error?: string;
}) {
  const extra = current && !(STUDENT_LEVELS as readonly string[]).includes(current) ? current : null;
  return (
    <SelectField label="Level" value={value} onChange={(e) => onChange(e.target.value)} error={error}>
      <option value="" disabled>
        Choose a level
      </option>
      {STUDENT_LEVELS.map((l) => (
        <option key={l} value={l}>
          {l} level
        </option>
      ))}
      {extra && <option value={extra}>{extra}</option>}
    </SelectField>
  );
}

function EditStudentDialog({ student, onClose, onSaved }: { student: StudentOut; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState({
    identifier: student.identifier,
    full_name: student.full_name,
    email: student.email ?? "",
    level: student.level,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const idChanged = normalizeIdentifier(values.identifier) !== student.identifier;
  const newEmail = values.email.trim().toLowerCase();
  // A registered student's email is where their reset links go, so only the super admin (or the student,
  // from their profile) can change it.
  const emailLocked = student.is_registered;
  const emailChanged = !emailLocked && newEmail !== "" && newEmail !== (student.email ?? "");

  const save = async () => {
    const result = check(studentUpdateSchema, values);
    const fieldErrors = result.errors ?? {};
    // An email can be changed but not removed.
    if (!emailLocked && student.email && !newEmail) fieldErrors.email = "Email address is required.";
    if (emailLocked) delete fieldErrors.email;
    setErrors(fieldErrors);
    if (!result.data || fieldErrors.email) return focusFirstError();
    setLoading(true);
    try {
      await api<StudentOut>(`admin/students/${student.id}`, {
        method: "PATCH",
        json: {
          full_name: values.full_name.trim(),
          level: values.level.trim(),
          ...(idChanged ? { identifier: normalizeIdentifier(values.identifier) } : {}),
          ...(emailChanged ? { email: newEmail } : {}),
        },
      });
      toast.success("Student updated.");
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "STUDENT_EXISTS" || err.field === "identifier")) setErrors({ identifier: err.message });
      else if (err instanceof ApiError && (err.code === "EMAIL_IN_USE" || err.code === "EMAIL_LOCKED" || err.field === "email"))
        setErrors({ email: err.message });
      else return toast.error(errorMessage(err));
      focusFirstError();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit student"
      description={student.full_name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={loading}>
            Save changes
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Matric / Registration number"
          value={values.identifier}
          onChange={(e) => setValues((v) => ({ ...v, identifier: e.target.value }))}
          onBlur={() => setValues((v) => ({ ...v, identifier: normalizeIdentifier(v.identifier) }))}
          error={errors.identifier}
          hint={IDENTIFIER_HINT}
        />
        {idChanged && student.is_registered && (
          <Alert tone="warning">This student is registered. They will log in with the new number from now on.</Alert>
        )}
        <TextField
          label="Full name"
          value={values.full_name}
          onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))}
          error={errors.full_name}
        />
        <TextField
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="student@example.com"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          error={errors.email}
          disabled={emailLocked}
          hint={
            emailLocked
              ? "This student has registered, so only they (from their profile) or the super admin can change it."
              : "The student's registration code is sent here."
          }
        />
        {!student.email && !student.is_registered && !newEmail && (
          <Alert tone="warning">This student has no email on file, so they can&apos;t register until you add one.</Alert>
        )}
        {emailChanged && !student.is_registered && student.email && (
          <Alert tone="info">Any registration code already sent to the old address will stop working.</Alert>
        )}
        <LevelField
          value={values.level}
          current={student.level}
          onChange={(level) => setValues((v) => ({ ...v, level }))}
          error={errors.level}
        />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
