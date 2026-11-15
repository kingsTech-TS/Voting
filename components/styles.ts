// Plain (non-client) style helpers, usable from Server and Client Components.
import clsx from "clsx";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "ink";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg hover:bg-primary-hover shadow-[0_8px_20px_-10px_var(--primary)]",
  ink: "bg-ink text-ink-fg hover:opacity-90",
  secondary: "bg-card text-foreground border border-border hover:bg-subtle",
  danger: "bg-danger text-white hover:opacity-90",
  ghost: "text-foreground hover:bg-subtle",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return clsx(
    "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background-color,opacity,transform,box-shadow] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-45",
    size === "sm" && "h-8 px-3 text-[13px]",
    size === "md" && "h-10 px-4.5 text-sm",
    size === "lg" && "h-12 px-6 text-[15px]",
    buttonVariants[variant],
    className,
  );
}
