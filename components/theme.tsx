"use client";

import clsx from "clsx";
import { useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY as KEY } from "./theme-script";

export type Theme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The viewer's saved choice, or null if they haven't picked one (then the OS theme applies). */
function stored(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

/** The theme actually on screen: saved choice, otherwise the device setting. */
function effective(): Theme {
  return stored() ?? (window.matchMedia(DARK_QUERY).matches ? "dark" : "light");
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", cb); // OS theme changes while no choice is saved
  window.addEventListener("storage", cb); // choice made in another tab
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
    window.removeEventListener("storage", cb);
  };
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // storage blocked: still apply for this page view
  }
  document.documentElement.setAttribute("data-theme", theme);
  listeners.forEach((l) => l());
}

/** Effective theme; null during server render (unknown until the browser runs). */
export function useTheme(): Theme | null {
  return useSyncExternalStore(subscribe, effective, () => null);
}

/**
 * Keeps the browser-tab icon in step with the theme on screen. app/icon.svg already follows the
 * device setting on its own; this makes it follow the site's Light/Dark switch too.
 */
export function FaviconSync() {
  const theme = useTheme();
  useEffect(() => {
    if (!theme) return;
    const href = theme === "dark" ? "/icon-dark.svg" : "/icon-light.svg";
    const apply = () => {
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
        if (link.getAttribute("href") !== href) {
          link.setAttribute("href", href);
          link.setAttribute("type", "image/svg+xml");
        }
      });
    };
    apply();
    // Next streams metadata (including the icon <link>) after hydration, and may re-render it on
    // navigation — re-apply whenever an icon link appears or changes. Writes only on a difference,
    // so this can't loop.
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["href"] });
    return () => observer.disconnect();
  }, [theme]);
  return null;
}

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: "light",
    label: "Light",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    ),
  },
];

/**
 * Light / Dark switch. Visitors start on their device's theme; picking one saves it.
 * `className` goes on an outer wrapper so visibility utilities (hidden, lg:hidden…) always win.
 */
export function ThemeToggle({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const theme = useTheme();
  return (
    <div className={className}>
      <div role="radiogroup" aria-label="Colour theme" className="inline-flex items-center gap-1 rounded-full bg-subtle p-1">
        {OPTIONS.map((o) => {
          const active = theme === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={o.label}
              title={o.label}
              onClick={() => setTheme(o.value)}
              className={clsx(
                "flex h-7 items-center justify-center gap-1.5 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                withLabel ? "px-3 text-xs font-semibold" : "w-7",
                active ? "bg-card text-foreground shadow-sm" : "text-muted hover:text-foreground",
              )}
            >
              {o.icon}
              {withLabel && o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
