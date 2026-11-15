"use client";

import { useEffect, useRef, useState } from "react";
import { api, refreshSession } from "./client";
import { readSession } from "@/lib/session";
import type { TallyOut } from "./types";

export type LiveStatus = "connecting" | "live" | "reconnecting" | "polling" | "ended";

const BACKOFF = [1000, 2000, 5000, 10000, 15000];
const POLL_MS = 5000;
const HIDDEN_CLOSE_MS = 60_000;

/**
 * Live tally over SSE (via the BFF, so the cookie authenticates it — no token in the URL).
 * Reconnects with backoff after refreshing the session; after 3 straight failures it polls
 * the authoritative tally endpoint instead.
 */
export function useLiveTally(electionId: string, enabled = true) {
  const [tally, setTally] = useState<TallyOut | null>(null);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const endedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !electionId) return;
    endedRef.current = false;
    let es: EventSource | null = null;
    let failures = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = undefined;
    };

    const poll = async () => {
      try {
        const t = await api<TallyOut>(`admin/elections/${electionId}/tally`);
        if (disposed) return;
        setTally(t);
        if (t.state === "ended") {
          endedRef.current = true;
          setStatus("ended");
          stopPolling();
        }
      } catch {
        // keep polling
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      setStatus("polling");
      void poll();
      pollTimer = setInterval(poll, POLL_MS);
    };

    const close = () => {
      es?.close();
      es = null;
    };

    const connect = () => {
      if (disposed || endedRef.current) return;
      close();
      es = new EventSource(`/api/v1/live/elections/${electionId}/stream`);
      es.addEventListener("tally", (e) => {
        failures = 0;
        stopPolling();
        setStatus("live");
        setTally(JSON.parse((e as MessageEvent).data));
      });
      es.addEventListener("ended", (e) => {
        endedRef.current = true;
        setTally(JSON.parse((e as MessageEvent).data));
        setStatus("ended");
        stopPolling();
        close();
      });
      es.onerror = async () => {
        if (disposed || endedRef.current) return;
        close();
        failures += 1;
        if (failures >= 3) startPolling();
        else setStatus("reconnecting");
        // The stream may have failed because the access token expired.
        await refreshSession(readSession()?.exp);
        const delay = BACKOFF[Math.min(failures - 1, BACKOFF.length - 1)];
        retryTimer = setTimeout(connect, delay);
      };
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenTimer = setTimeout(close, HIDDEN_CLOSE_MS);
      } else {
        if (hiddenTimer) clearTimeout(hiddenTimer);
        if (!es && !endedRef.current && !pollTimer) connect();
      }
    };

    connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      close();
      stopPolling();
      if (retryTimer) clearTimeout(retryTimer);
      if (hiddenTimer) clearTimeout(hiddenTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [electionId, enabled]);

  return { tally, status, setTally };
}
