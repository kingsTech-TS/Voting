"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { IconPlus, IconUpload } from "@/components/icons";
import { StudentsTable } from "@/components/staff";
import { buttonClass } from "@/components/styles";
import { Alert, Button, ConfirmDialog, Dialog, PageHeader, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { MessageOut, SessionStateOut, StudentBulkDeleteOut, StudentOut } from "@/lib/api/types";
import { IDENTIFIER_HINT, check, normalizeIdentifier, studentCreateSchema, studentUpdateSchema, type FieldErrors } from "@/lib/validation";

type Pending = { kind: "edit" | "delete"; student: StudentOut } | null;
type BulkPending = { students: StudentOut[]; clear: () => void } | null;

export function AdminStudents() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState<BulkPending>(null);
  const session = useQuery({ queryKey: ["session"], queryFn: () => api<SessionStateOut>("admin/session") });
  const firstYear = session.data?.levels.find((l) => l.level === "100")?.count;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["students"] });

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
      void invalidate();
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
      void invalidate();
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
            <Button variant="ink" onClick={() => setAdding(true)}>
              <IconPlus size={16} /> Add student
            </Button>
          </>
        }
      />
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
        bulkActions={(students, clear) => (
          <Button variant="danger" size="sm" onClick={() => setBulk({ students, clear })}>
            Delete {students.length.toLocaleString()} student{students.length === 1 ? "" : "s"}
          </Button>
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

      <AddStudentDialog open={adding} onClose={() => setAdding(false)} onSaved={() => void invalidate()} />
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

function AddStudentDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const empty = { identifier: "", full_name: "", level: "" };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent, addAnother: boolean) => {
    e.preventDefault();
    const result = check(studentCreateSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data) return;
    setLoading(true);
    try {
      const s = await api<StudentOut>("admin/students", {
        json: { identifier: normalizeIdentifier(values.identifier), full_name: values.full_name.trim(), level: values.level.trim() },
      });
      toast.success(`${s.full_name} added.`);
      onSaved();
      setValues(addAnother ? { ...empty, level: values.level } : empty);
      if (!addAnother) onClose();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "STUDENT_EXISTS" || err.field === "identifier")) {
        setErrors({ identifier: err.message });
      } else toast.error(errorMessage(err));
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
            Save
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => void submit(e, false)} noValidate>
        <TextField
          label="Matric / Registration number"
          value={values.identifier}
          onChange={(e) => setValues((v) => ({ ...v, identifier: e.target.value }))}
          onBlur={() => setValues((v) => ({ ...v, identifier: normalizeIdentifier(v.identifier) }))}
          error={errors.identifier}
          hint={IDENTIFIER_HINT}
        />
        <TextField
          label="Full name"
          value={values.full_name}
          onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))}
          error={errors.full_name}
        />
        <TextField
          label="Level"
          placeholder="e.g. 300"
          value={values.level}
          onChange={(e) => setValues((v) => ({ ...v, level: e.target.value }))}
          error={errors.level}
        />
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}

function EditStudentDialog({ student, onClose, onSaved }: { student: StudentOut; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState({ identifier: student.identifier, full_name: student.full_name, level: student.level });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const idChanged = normalizeIdentifier(values.identifier) !== student.identifier;

  const save = async () => {
    const result = check(studentUpdateSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data) return;
    setLoading(true);
    try {
      await api<StudentOut>(`admin/students/${student.id}`, {
        method: "PATCH",
        json: {
          full_name: values.full_name.trim(),
          level: values.level.trim(),
          ...(idChanged ? { identifier: normalizeIdentifier(values.identifier) } : {}),
        },
      });
      toast.success("Student updated.");
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "STUDENT_EXISTS" || err.field === "identifier")) setErrors({ identifier: err.message });
      else toast.error(errorMessage(err));
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
        <TextField label="Level" value={values.level} onChange={(e) => setValues((v) => ({ ...v, level: e.target.value }))} error={errors.level} />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
