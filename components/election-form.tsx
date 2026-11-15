"use client";

import { useState, type FormEvent } from "react";
import { Button, TextAreaField, TextField } from "@/components/ui";
import { ApiError } from "@/lib/api/errors";
import { toLocalInput } from "@/lib/time";
import { check, electionSchema, type FieldErrors } from "@/lib/validation";
import type { ElectionOut } from "@/lib/api/types";

export interface ElectionFormValues {
  title: string;
  description: string;
  start_time: string; // datetime-local, WAT
  end_time: string;
}

export function electionToForm(e: ElectionOut): ElectionFormValues {
  return {
    title: e.title,
    description: e.description ?? "",
    start_time: toLocalInput(e.start_time),
    end_time: toLocalInput(e.end_time),
  };
}

export function ElectionForm({
  initial,
  submitLabel,
  disabled,
  onSubmit,
}: {
  initial: ElectionFormValues;
  submitLabel: string;
  disabled?: boolean;
  onSubmit: (values: ElectionFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof ElectionFormValues) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const result = check(electionSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data) return;
    setLoading(true);
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message });
      else if (err instanceof ApiError && err.code === "INVALID_TIMES") setErrors({ end_time: err.message });
      else setFormError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {formError && <p className="text-sm font-medium text-danger">{formError}</p>}
      <TextField label="Title" value={values.title} onChange={set("title")} error={errors.title} disabled={disabled} placeholder="e.g. SUG Elections 2026" />
      <TextAreaField
        label="Description (optional)"
        value={values.description}
        onChange={set("description")}
        error={errors.description}
        disabled={disabled}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Voting starts (WAT)"
          type="datetime-local"
          value={values.start_time}
          onChange={set("start_time")}
          error={errors.start_time}
          disabled={disabled}
        />
        <TextField
          label="Voting ends (WAT)"
          type="datetime-local"
          value={values.end_time}
          onChange={set("end_time")}
          error={errors.end_time}
          disabled={disabled}
        />
      </div>
      {!disabled && (
        <div className="flex justify-end">
          <Button type="submit" loading={loading}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
