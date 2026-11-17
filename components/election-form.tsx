"use client";

import clsx from "clsx";
import { useState, type FormEvent } from "react";
import { IconCheck, IconMail } from "@/components/icons";
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
  auto_share_results: boolean;
}

export const EMPTY_ELECTION_FORM: ElectionFormValues = {
  title: "",
  description: "",
  start_time: "",
  end_time: "",
  auto_share_results: false,
};

export function electionToForm(e: ElectionOut): ElectionFormValues {
  return {
    title: e.title,
    description: e.description ?? "",
    start_time: toLocalInput(e.start_time),
    end_time: toLocalInput(e.end_time),
    auto_share_results: e.auto_share_results,
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
      <AutoShareOption
        checked={values.auto_share_results}
        disabled={disabled}
        onChange={(auto_share_results) => setValues((v) => ({ ...v, auto_share_results }))}
      />
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

/** "Send the results summary to students when the election ends" tick box, styled as a card. */
function AutoShareOption({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      className={clsx(
        "group flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
        checked ? "border-primary bg-primary-soft" : "border-border bg-card hover:bg-subtle",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden="true"
        className={clsx(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          checked ? "border-primary bg-primary text-primary-fg" : "border-border-strong bg-card",
        )}
      >
        {checked && <IconCheck size={12} strokeWidth={3.5} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <IconMail size={15} className="text-primary" />
          Send the results summary to students when the election ends
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-muted">
          Every registered student with an email gets the winners and turnout in their inbox within a minute of voting closing.
          You can also send it manually from the results page.
        </span>
      </span>
    </label>
  );
}
