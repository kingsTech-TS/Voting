"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { IconInbox } from "@/components/icons";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, PageSpinner, TextAreaField, TextField } from "@/components/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import type { CursorPage, SentMessageOut, StaffOut } from "@/lib/api/types";
import { formatWAT } from "@/lib/time";
import { check, messageSchema, type FieldErrors } from "@/lib/validation";
import { focusFirstError } from "@/lib/focus-error";
import { useAllAdmins } from "../use-admins";

export function SuperAdminMessages() {
  const admins = useAllAdmins();
  const byId = new Map((admins.data ?? []).map((a) => [a.id, a]));
  return (
    <>
      <PageHeader title="Messages" description="Send messages to admins and see who has read them." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Compose admins={admins.data ?? []} loadingAdmins={admins.isPending} />
        <Sent byId={byId} />
      </div>
    </>
  );
}

function Compose({ admins, loadingAdmins }: { admins: StaffOut[]; loadingAdmins: boolean }) {
  const queryClient = useQueryClient();
  const [toAll, setToAll] = useState(true);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) => setRecipients((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const values = { to_all: toAll, recipient_ids: toAll ? [] : recipients, subject, body };
    const result = check(messageSchema, values);
    setErrors(result.errors ?? {});
    if (!result.data) return focusFirstError();
    setLoading(true);
    try {
      await api<SentMessageOut>("super-admin/messages", { json: result.data });
      toast.success("Message sent.");
      setSubject("");
      setBody("");
      setRecipients([]);
      void queryClient.invalidateQueries({ queryKey: ["sent-messages"] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-fit">
      <h2 className="mb-4 font-semibold">New message</h2>
      <form onSubmit={send} className="flex flex-col gap-4" noValidate>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">To</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="to" checked={toAll} onChange={() => setToAll(true)} className="accent-primary" />
            All admins
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="to" checked={!toAll} onChange={() => setToAll(false)} className="accent-primary" />
            Choose admins
          </label>
          {!toAll && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2" aria-invalid={errors.recipient_ids ? true : undefined}>
              {loadingAdmins ? (
                <p className="p-2 text-sm text-muted">Loading admins…</p>
              ) : admins.length === 0 ? (
                <p className="p-2 text-sm text-muted">No admins yet.</p>
              ) : (
                admins.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-subtle">
                    <input type="checkbox" checked={recipients.includes(a.id)} onChange={() => toggle(a.id)} className="accent-primary" />
                    <span className="truncate">{a.full_name ? `${a.full_name} · ${a.email}` : a.email}</span>
                    {a.status === "suspended" && <Badge tone="danger">Suspended</Badge>}
                  </label>
                ))
              )}
            </div>
          )}
          {errors.recipient_ids && <p className="text-xs font-medium text-danger">{errors.recipient_ids}</p>}
        </fieldset>
        <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} error={errors.subject} maxLength={200} />
        <TextAreaField label="Message" value={body} onChange={(e) => setBody(e.target.value)} error={errors.body} rows={6} maxLength={10000} />
        <Button type="submit" loading={loading}>
          Send message
        </Button>
      </form>
    </Card>
  );
}

function Sent({ byId }: { byId: Map<string, StaffOut> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, error, isPending, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["sent-messages"],
    queryFn: ({ pageParam }) => api<CursorPage<SentMessageOut>>("super-admin/messages", { query: { before: pageParam, limit: 20 } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  const items = data?.pages.flatMap((p) => p.items) ?? [];
  const label = (id: string) => byId.get(id)?.email ?? "Deleted admin";

  return (
    <section>
      <h2 className="mb-3 font-semibold">Sent</h2>
      {isPending ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon={<IconInbox size={20} />} title="No messages sent yet" />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((m) => {
            const readIds = new Map(m.read_by.map((r) => [r.user_id, r.read_at]));
            const open = expanded === m.id;
            return (
              <li key={m.id} className="surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{m.subject}</p>
                    <p className="text-xs text-muted">{formatWAT(m.created_at)}</p>
                  </div>
                  <Badge tone={m.read_by.length === m.recipient_ids.length ? "success" : "neutral"}>
                    Read by {m.read_by.length} of {m.recipient_ids.length}
                  </Badge>
                </div>
                <p className={open ? "mt-3 whitespace-pre-wrap text-sm" : "mt-2 line-clamp-2 text-sm text-muted"}>{m.body}</p>
                <Button variant="ghost" size="sm" className="mt-2 -ml-2" aria-expanded={open} onClick={() => setExpanded(open ? null : m.id)}>
                  {open ? "Hide details" : "Show read receipts"}
                </Button>
                {open && (
                  <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-3 text-sm">
                    {m.recipient_ids.map((id) => (
                      <li key={id} className="flex justify-between gap-3">
                        <span className="truncate">{label(id)}</span>
                        <span className={readIds.has(id) ? "text-primary" : "text-muted"}>
                          {readIds.has(id) ? `Read ${formatWAT(readIds.get(id))}` : "Unread"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => void fetchNextPage()} loading={isFetchingNextPage}>
            Load older messages
          </Button>
        </div>
      )}
    </section>
  );
}
