"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ProfilePictureForm } from "@/components/profile-picture-form";
import { IconArrowLeft, IconCheck, IconKey, IconLock, IconMail } from "@/components/icons";
import { ThemeToggle } from "@/components/theme";
import { Alert, Avatar, Button, Dialog, ErrorState, PageSpinner, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { email as emailSchema, type FieldErrors } from "@/lib/validation";
import type { PasswordResetSentOut, StudentProfileOut } from "@/lib/api/types";

export function StudentProfile() {
  const [changing, setChanging] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { data, error, refetch, isPending } = useQuery({
    queryKey: ["student", "me"],
    queryFn: () => api<StudentProfileOut>("students/me"),
  });

  if (isPending) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/student" className="inline-flex items-center gap-1.5 self-start text-sm text-muted transition-colors hover:text-foreground">
        <IconArrowLeft size={15} /> Dashboard
      </Link>
      <section className="surface overflow-hidden">
        <div className="flex items-center justify-between bg-primary-soft px-6 py-3 text-primary">
          <p className="text-xs font-medium text-muted">Voter card</p>
          <p className="num text-[11px] text-muted">{data.id_type === "matric" ? "MATRIC" : "REG"}</p>
        </div>
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <Avatar src={data.profile_picture_url} name={data.full_name} size={112} className="rounded-xl" />
          <div className="min-w-0">
            <h1 className="font-display text-[28px] leading-tight">{data.full_name}</h1>
            <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted">
                  {data.id_type === "matric" ? "Matric no." : "Reg. no."}
                </dt>
                <dd className="num mt-0.5 font-medium">{data.identifier}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted">Level</dt>
                <dd className="num mt-0.5 font-medium">{data.level}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted">Dues</dt>
                <dd className={data.paid ? "mt-0.5 font-semibold text-primary" : "mt-0.5 font-medium text-muted"}>
                  {data.paid ? "Paid ✓" : "Not confirmed"}
                </dd>
              </div>
              {data.unique_name && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-muted">Unique name</dt>
                  <dd className="num mt-0.5 font-semibold text-primary">{data.unique_name}</dd>
                  <p className="mt-1 text-xs text-muted">Shown instead of your real name wherever votes are listed.</p>
                </div>
              )}
            </dl>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3.5">
          <p className="text-xs text-muted">Name or level wrong? Ask your admin to correct it.</p>
          <Button variant="secondary" size="sm" onClick={() => setChanging(true)}>
            Change photo
          </Button>
        </div>
      </section>

      <section className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <IconMail size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight">Email</h2>
            {data.email ? (
              <p className="mt-0.5 truncate text-sm text-muted">{data.email}</p>
            ) : (
              <p className="mt-0.5 text-sm text-warning">Add an email so you can reset your password and receive results.</p>
            )}
          </div>
        </div>
        <Button variant={data.email ? "secondary" : "primary"} size="sm" onClick={() => setEditingEmail(true)}>
          {data.email ? "Change email" : "Add email"}
        </Button>
      </section>

      <section className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <IconLock size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight">Password</h2>
            <p className="mt-0.5 text-sm text-muted">
              {data.email ? "We'll email you a secure link to choose a new one." : "Add an email first to reset your password."}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setResetting(true)} disabled={!data.email}>
          <IconKey size={15} /> Reset password
        </Button>
      </section>

      <section className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold tracking-tight">Appearance</h2>
          <p className="mt-0.5 text-sm text-muted">Starts with your device&apos;s theme. Your choice is saved on this device.</p>
        </div>
        <ThemeToggle withLabel />
      </section>

      {editingEmail && <EmailDialog current={data.email} onClose={() => setEditingEmail(false)} />}
      {resetting && <ResetPasswordDialog email={data.email} onClose={() => setResetting(false)} />}

      <Dialog open={changing} onClose={() => setChanging(false)} title="Change profile picture">
        <ProfilePictureForm
          submitLabel="Save picture"
          onDone={() => {
            toast.success("Profile picture updated.");
            setChanging(false);
          }}
        />
      </Dialog>
    </div>
  );
}

/** Two steps: enter the email, then prove the account is yours with your current password. */
function EmailDialog({ current, onClose }: { current: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"email" | "confirm">("email");
  const [email, setEmail] = useState(current ?? "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = () => {
    const result = emailSchema.safeParse(email);
    if (!result.success) return setErrors({ email: result.error.issues[0]?.message ?? "Enter a valid email address." });
    if (current && result.data === current.toLowerCase()) return setErrors({ email: "That's already your email." });
    setEmail(result.data);
    setErrors({});
    setStep("confirm");
  };

  const save = async () => {
    if (!password) return setErrors({ current_password: "Enter your password." });
    setLoading(true);
    setError(null);
    try {
      const updated = await api<StudentProfileOut>("students/me/email", {
        method: "PUT",
        json: { email, current_password: password },
      });
      queryClient.setQueryData(["student", "me"], updated);
      toast.success(current ? "Email updated." : "Email added. You can now reset your password any time.");
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVALID_PASSWORD") setErrors({ current_password: err.message });
      else if (err instanceof ApiError && err.code === "EMAIL_IN_USE") {
        setErrors({ email: err.message });
        setStep("email");
      } else setError(errorMessage(err));
      setLoading(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step === "email") next();
    else void save();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!loading}
      title={step === "email" ? (current ? "Change email" : "Add your email") : "Confirm it's you"}
      description={
        step === "email"
          ? "Used for password reset links and election results."
          : "Enter your current password to confirm this account is really yours."
      }
      footer={
        step === "email" ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={next}>Continue</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep("email")} disabled={loading}>
              Back
            </Button>
            <Button onClick={() => void save()} loading={loading}>
              Confirm and save
            </Button>
          </>
        )
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <ol className="flex items-center gap-2 text-xs font-semibold" aria-label="Steps">
          {(["email", "confirm"] as const).map((k, i) => {
            const done = k === "email" && step === "confirm";
            const active = k === step;
            return (
              <li key={k} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-6 bg-border-strong" aria-hidden="true" />}
                <span
                  className={
                    active || done
                      ? "flex size-5 items-center justify-center rounded-full bg-primary text-primary-fg"
                      : "flex size-5 items-center justify-center rounded-full bg-subtle text-muted"
                  }
                >
                  {done ? <IconCheck size={11} strokeWidth={3} /> : i + 1}
                </span>
                <span className={active ? "text-foreground" : "text-muted"}>{k === "email" ? "Email" : "Password"}</span>
              </li>
            );
          })}
        </ol>
        {error && <Alert tone="danger">{error}</Alert>}
        {step === "email" ? (
          <TextField
            label="Email address"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
        ) : (
          <>
            <div className="flex items-center gap-3 rounded-2xl bg-primary-soft px-4 py-3">
              <IconMail size={17} className="shrink-0 text-primary" />
              <span className="min-w-0 truncate text-sm font-semibold">{email}</span>
            </div>
            <TextField
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.current_password}
            />
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

function ResetPasswordDialog({ email, onClose }: { email: string | null; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const send = async () => {
    setLoading(true);
    try {
      const res = await api<PasswordResetSentOut>("students/me/password-reset", { method: "POST" });
      setSentTo(res.email_hint);
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
      dismissible={!loading}
      title={sentTo ? "Check your inbox" : "Reset your password?"}
      footer={
        sentTo ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={send} loading={loading}>
              Send reset link
            </Button>
          </>
        )
      }
    >
      {sentTo ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-primary-soft px-5 py-7 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-fg">
            <IconMail size={22} />
          </span>
          <p className="text-sm leading-relaxed text-foreground/80">
            We sent a reset link to <span className="font-semibold text-foreground">{sentTo}</span>. It expires in 30 minutes. After you
            set a new password you&apos;ll be signed out everywhere and can log in again.
          </p>
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          We&apos;ll email a secure link to <span className="font-semibold text-foreground">{email}</span>. Open it to create and confirm a
          new password.
        </p>
      )}
    </Dialog>
  );
}
