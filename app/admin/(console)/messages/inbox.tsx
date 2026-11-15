"use client";

import clsx from "clsx";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useState } from "react";
import { IconInbox } from "@/components/icons";
import { Button, Dialog, EmptyState, ErrorState, PageHeader, PageSpinner } from "@/components/ui";
import { api } from "@/lib/api/client";
import type { CursorPage, InboxMessageOut } from "@/lib/api/types";
import { formatWAT } from "@/lib/time";

export function Inbox() {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [open, setOpen] = useState<InboxMessageOut | null>(null);
  const key = ["admin", "inbox", unreadOnly] as const;

  const { data, error, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) =>
      api<CursorPage<InboxMessageOut>>("admin/messages", { query: { before: pageParam, limit: 20, unread_only: unreadOnly || undefined } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const openMessage = async (m: InboxMessageOut) => {
    setOpen(m);
    if (m.read) return;
    // Optimistically mark as read everywhere it appears.
    for (const k of [["admin", "inbox", false], ["admin", "inbox", true]]) {
      queryClient.setQueryData<InfiniteData<CursorPage<InboxMessageOut>>>(k, (old) =>
        old && {
          ...old,
          pages: old.pages.map((p) => ({ ...p, items: p.items.map((x) => (x.id === m.id ? { ...x, read: true } : x)) })),
        },
      );
    }
    queryClient.setQueryData<{ unread: number }>(["admin", "unread"], (old) => (old ? { unread: Math.max(0, old.unread - 1) } : old));
    try {
      await api(`admin/messages/${m.id}/read`, { method: "POST" });
    } finally {
      void queryClient.invalidateQueries({ queryKey: ["admin", "unread"] });
    }
  };

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader
        title="Messages"
        description="Messages from the super admin."
        actions={
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} className="size-4 accent-primary" />
            Unread only
          </label>
        }
      />
      {isPending ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<IconInbox size={20} />} title={unreadOnly ? "No unread messages" : "No messages yet"} />
      ) : (
        <ul className="divide-y divide-border surface overflow-hidden">
          {items.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => void openMessage(m)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-subtle">
                <span className={clsx("mt-1.5 size-2 shrink-0 rounded-full", m.read ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className={clsx("truncate", !m.read && "font-semibold")}>{m.subject}</span>
                    <span className="shrink-0 text-xs text-muted">{formatWAT(m.created_at)}</span>
                  </span>
                  <span className="block truncate text-sm text-muted">
                    <span className="sr-only">{m.read ? "Read. " : "Unread. "}</span>
                    Super admin — {m.body}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => void fetchNextPage()} loading={isFetchingNextPage}>
            Load older messages
          </Button>
        </div>
      )}

      <Dialog open={!!open} onClose={() => setOpen(null)} title={open?.subject ?? ""} wide>
        <p className="mb-4 text-xs text-muted">From the super admin · {formatWAT(open?.created_at)}</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{open?.body}</p>
      </Dialog>
    </>
  );
}
