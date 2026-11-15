"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { IconPlus, IconUpload } from "@/components/icons";
import { StudentsTable } from "@/components/staff";
import { buttonClass } from "@/components/styles";
import { Button, ConfirmDialog, Dialog, PageHeader, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { MessageOut, StudentOut } from "@/lib/api/types";
import { IDENTIFIER_HINT, check, normalizeIdentifier, studentCreateSchema, studentUpdateSchema, type FieldErrors } from "@/lib/validation";

type Pending = { kind: "edit" | "delete" | "reset"; student: StudentOut } | null;

export function AdminStudents() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["students"] });

  const runAction = async () => {
    if (!pending || pending.kind === "edit") return;
    setBusy(true);
    try {
      const path = `admin/students/${pending.student.id}${pending.kind === "reset" ? "/reset-registration" : ""}`;
      const res = await api<MessageOut>(path, { method: pending.kind === "delete" ? "DELETE" : "POST" });
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
              <IconUpload size={16} /> Import CSV
            </Link>
            <Button variant="ink" onClick={() => setAdding(true)}>
              <IconPlus size={16} /> Add student
            </Button>
          </>
        }
      />
      <StudentsTable
        endpoint="admin/students"
        actions={(s) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPending({ kind: "edit", student: s })}>
              Edit
            </Button>
            {s.is_registered && (
              <Button variant="ghost" size="sm" onClick={() => setPending({ kind: "reset", student: s })}>
                Reset
              </Button>
            )}
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
        title="Remove student?"
        confirmLabel="Remove"
      >
        {pending?.student.full_name} ({pending?.student.identifier}) will be removed and will no longer be able to log in. Students who
        have already voted cannot be removed.
      </ConfirmDialog>
      <ConfirmDialog
        open={pending?.kind === "reset"}
        onClose={() => setPending(null)}
        onConfirm={runAction}
        loading={busy}
        title="Reset registration?"
        confirmLabel="Reset"
      >
        Use this when {pending?.student.full_name} has forgotten their password. Their password is cleared and they will need to register
        again with their Matric/Reg number. Existing votes are kept.
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
  const [values, setValues] = useState({ full_name: student.full_name, level: student.level });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const result = check(studentUpdateSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data) return;
    setLoading(true);
    try {
      await api<StudentOut>(`admin/students/${student.id}`, { method: "PATCH", json: result.data });
      toast.success("Student updated.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit ${student.identifier}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={loading}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField
          label="Full name"
          value={values.full_name}
          onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))}
          error={errors.full_name}
        />
        <TextField label="Level" value={values.level} onChange={(e) => setValues((v) => ({ ...v, level: e.target.value }))} error={errors.level} />
      </div>
    </Dialog>
  );
}
