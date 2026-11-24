"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { StudentsTable } from "@/components/staff";
import { Alert, Button, Dialog, PageHeader, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { StudentOut } from "@/lib/api/types";
import { check, email, type FieldErrors } from "@/lib/validation";
import { focusFirstError } from "@/lib/focus-error";
import { z } from "zod";

const emailSchema = z.object({ email });

export function SuperAdminStudents() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<StudentOut | null>(null);

  return (
    <>
      <PageHeader
        title="Students"
        description="Admins add and manage students. Only you can change the email of a student who has already registered."
      />
      <StudentsTable
        endpoint="super-admin/students"
        actions={(s) =>
          s.is_registered ? (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                Change email
              </Button>
            </div>
          ) : null
        }
      />
      {editing && (
        <ChangeEmailDialog
          student={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void queryClient.invalidateQueries({ queryKey: ["students"] })}
        />
      )}
    </>
  );
}

function ChangeEmailDialog({ student, onClose, onSaved }: { student: StudentOut; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(student.email ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const save = async () => {
    const result = check(emailSchema, { email: value });
    if (!result.data) {
      setErrors(result.errors);
      return focusFirstError();
    }
    if (result.data.email === (student.email ?? "")) return onClose();
    setErrors({});
    setLoading(true);
    try {
      await api<StudentOut>(`super-admin/students/${student.id}`, { method: "PATCH", json: { email: result.data.email } });
      toast.success("Email changed. The student has been signed out and told at their old address.");
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && (err.code === "EMAIL_IN_USE" || err.field === "email")) {
        setErrors({ email: err.message });
        focusFirstError();
      } else {
        toast.error(errorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title="Change email"
      description={`${student.full_name} · ${student.identifier}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={loading}>
            Change email
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
        <Alert tone="warning">
          Password-reset links go to this address, so whoever controls it controls the account. Only change it when you are sure
          the request really comes from the student. They will be signed out everywhere, and their old address will be told.
        </Alert>
        <TextField
          label="New email address"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={errors.email}
        />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
