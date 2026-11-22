/**
 * Take the user back to the first field with an error: scroll it into view and put the cursor in it.
 *
 * Call it right after setting validation errors (client-side checks or a field error from the API).
 * Fields mark themselves with `aria-invalid="true"` (TextField, TextAreaField and the other inputs
 * do this when they get an `error`); a group (e.g. a set of radio buttons) can carry it too, and the
 * first focusable control inside it is focused. Use `data-invalid` where `aria-invalid` isn't allowed
 * (e.g. around a button).
 */
const INVALID = '[aria-invalid="true"], [data-invalid="true"]';
const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The open modal dialog on top, if any, so a field behind it is never picked. */
function scope(root?: ParentNode | null): ParentNode {
  if (root) return root;
  const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
  return dialogs.length ? dialogs[dialogs.length - 1] : document;
}

export function focusFirstError(root?: ParentNode | null) {
  if (typeof window === "undefined") return;
  // Wait for React to render the error state (two frames also covers updates made after an await).
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const field = scope(root).querySelector<HTMLElement>(INVALID);
      if (!field) return;
      const target = field.matches(FOCUSABLE) ? field : (field.querySelector<HTMLElement>(FOCUSABLE) ?? field);
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      field.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      target.focus({ preventScroll: true });
    }),
  );
}
