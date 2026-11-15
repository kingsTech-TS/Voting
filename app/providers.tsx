"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { refreshSession } from "@/lib/api/client";
import { FaviconSync } from "@/components/theme";
import { readSession } from "@/lib/session";

/** Refresh the access token ~60 s before it expires (only while the tab is visible). */
function SessionKeeper() {
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const s = readSession();
      if (s && s.exp - Date.now() < 60_000) void refreshSession(s.exp);
    };
    const id = setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: (count, err) => {
              // Don't retry client errors (validation, auth, not found, rate limit).
              if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
              return count < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionKeeper />
      <FaviconSync />
      {children}
      <Toaster
        position="top-center"
        gap={8}
        toastOptions={{
          classNames: {
            toast:
              "!rounded-lg !border !border-border !bg-card !text-foreground !shadow-[0_12px_32px_-12px_rgb(0_0_0/0.25)] !font-sans !text-[13px] !gap-2.5",
            description: "!text-muted",
            success: "[&_[data-icon]]:!text-primary",
            error: "[&_[data-icon]]:!text-danger",
            warning: "[&_[data-icon]]:!text-warning",
            info: "[&_[data-icon]]:!text-info",
          },
        }}
      />
    </QueryClientProvider>
  );
}
