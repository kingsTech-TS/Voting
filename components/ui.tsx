"use client";

import clsx from "clsx";
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import { IconAlert, IconArrowLeft, IconCheck, IconInfo, IconX } from "./icons";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./styles";

// ---- Button ---------------------------------------------------------------------------------------

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, className)}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
});

/** Same look as Button, for links. */
export { buttonClass };

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mb-5 flex w-fit items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-foreground">
      <IconArrowLeft size={14} />
      {children}
    </Link>
  );
}

// ---- Form fields ----------------------------------------------------------------------------------

const inputClass =
  "w-full surface px-3.5 text-sm text-foreground placeholder:text-muted/80 transition-[border-color,box-shadow] hover:border-muted/60 focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-70";

interface FieldProps {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  children: (id: string, describedBy: string | undefined) => ReactNode;
  className?: string;
  /** Shows a red asterisk after the label. */
  required?: boolean;
}

export function Field({ label, error, hint, children, className, required }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-foreground">
        {label}
        {required && (
          <>
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        )}
      </label>
      {children(id, describedBy)}
      {hint && !error && (
        <div id={hintId} className="text-xs leading-relaxed text-muted">
          {hint}
        </div>
      )}
      {error && (
        <p id={errId} role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger">
          <IconAlert size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

export function TextField({ label, error, hint, className, ...rest }: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} className={className} required={rest.required}>
      {(id, describedBy) => (
        <input
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className={clsx(inputClass, "h-11", error && "border-danger focus:border-danger focus:ring-danger/15")}
          {...rest}
        />
      )}
    </Field>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
}

export function TextAreaField({ label, error, hint, className, ...rest }: TextAreaFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(id, describedBy) => (
        <textarea
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className={clsx(inputClass, "min-h-24 py-2.5 leading-relaxed", error && "border-danger")}
          {...rest}
        />
      )}
    </Field>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(inputClass, "h-11 cursor-pointer pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(inputClass, "h-11", className)} {...rest} />;
}

// ---- Layout bits ----------------------------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("surface p-6", className)}>{children}</div>;
}

/** Card with a ruled header row: "TITLE ........ actions". */
export function Panel({ title, actions, children, className, bodyClassName }: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={clsx("surface overflow-hidden", className)}>
      <header className="flex min-h-14 items-center justify-between gap-3 px-6 pt-5">
        <h2 className="text-base font-bold tracking-tight">{title}</h2>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className={clsx("p-6 pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-sm font-medium text-muted">{eyebrow}</div>}
        <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em]">{title}</h1>
        {description && <div className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx("animate-spin", className ?? "size-5")} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-48 flex-1 items-center justify-center gap-3 text-muted" role="status">
      <Spinner className="size-4" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Placeholder block while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-subtle", className)} />;
}

type Tone = "neutral" | "success" | "danger" | "warning" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-subtle text-muted",
  success: "bg-primary-soft text-primary",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
};
const dots: Record<Tone, string> = {
  neutral: "bg-muted",
  success: "bg-primary",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
};

export function Badge({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean | "pulse" }) {
  return (
    <span className={clsx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold", tones[tone], className)}>
      {dot && (
        <span className="relative flex size-1.5">
          {dot === "pulse" && <span className={clsx("absolute inline-flex size-full animate-ping rounded-full opacity-60", dots[tone])} />}
          <span className={clsx("relative inline-flex size-1.5 rounded-full", dots[tone])} />
        </span>
      )}
      {children}
    </span>
  );
}

const alertIcon: Record<Tone, ReactNode> = {
  neutral: <IconInfo size={16} />,
  info: <IconInfo size={16} />,
  success: <IconCheck size={16} />,
  warning: <IconAlert size={16} />,
  danger: <IconAlert size={16} />,
};

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: string; children?: ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={clsx("flex gap-3 rounded-2xl px-4 py-3.5 text-sm", tones[tone], className)}>
      <span className="mt-0.5 shrink-0">{alertIcon[tone]}</span>
      <div className="min-w-0 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={clsx(title && "mt-0.5", "text-foreground/80")}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</div>}
      <p className="text-base font-bold">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  return (
    <div className="rounded-3xl bg-danger-soft p-6" role="alert">
      <p className="flex items-center gap-2 font-medium text-danger">
        <IconAlert size={16} /> Couldn&apos;t load this
      </p>
      <p className="mt-1 text-sm text-foreground/80">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// ---- Avatar ---------------------------------------------------------------------------------------

export function Avatar({ src, name, size = 40, className }: { src?: string | null; name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle font-medium text-muted ring-1 ring-border",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
    >
      {src ? (
        // Cloudinary already serves 400x400 optimised images.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="size-full object-cover" width={size} height={size} loading="lazy" />
      ) : (
        <span aria-hidden="true">{initials || "?"}</span>
      )}
    </span>
  );
}

// ---- Dialog ---------------------------------------------------------------------------------------

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  dismissible?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const focusable = node?.querySelector<HTMLElement>("input, textarea, select, button:not([data-close])");
    (focusable ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-[rgb(10_20_16/0.45)] backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          "animate-dialog-in flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-card-border bg-card shadow-[var(--shadow-pop)] outline-none sm:rounded-[28px]",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold tracking-tight">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-muted">{description}</div>}
          </div>
          {dismissible && (
            <button
              data-close
              type="button"
              onClick={onClose}
              className="-mr-2 rounded-md p-1.5 text-muted transition-colors hover:bg-subtle hover:text-foreground"
              aria-label="Close"
            >
              <IconX size={16} />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-6 pb-6 pt-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-muted">{children}</div>
    </Dialog>
  );
}

// ---- Pagination -----------------------------------------------------------------------------------

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-[13px] text-muted">
      <span>
        <span className="num text-foreground">
          {from}–{to}
        </span>{" "}
        of <span className="num text-foreground">{total.toLocaleString()}</span>
      </span>
      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

// ---- Table ----------------------------------------------------------------------------------------

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="surface overflow-x-auto p-2">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={clsx("h-10 px-4 text-xs font-medium text-muted", className)}>{children}</th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={clsx("border-t border-border px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}

/** Small uppercase label used above values and sections. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("text-sm font-semibold text-foreground", className)}>{children}</p>;
}
