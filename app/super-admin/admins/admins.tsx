"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  PageHeader,
  PageSpinner,
  Pagination,
  Select,
  Table,
  Td,
  TextField,
  Th,
} from "@/components/ui";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import type { AdminCreatedOut, MessageOut, Page, StaffOut } from "@/lib/api/types";
import { formatDate, formatWAT } from "@/lib/time";
import { check, email as emailSchema } from "@/lib/validation";
import { z } from "zod";

type Action = "suspend" | "unsuspend" | "reset" | "delete";

export function AdminsManager() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"" | "active" | "suspended">("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<{ action: Action; admin: StaffOut } | null>(null);
  const [busy, setBusy] = useState(false);
  const [credentials, setCredentials] = useState<AdminCreatedOut | null>(null);

  const { data, error, isPending, refetch } = useQuery({
    queryKey: ["admins", status, page],
    queryFn: () => api<Page<StaffOut>>("super-admin/admins", { query: { status: status || undefined, page, page_size: 50 } }),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admins"] });

  const run = async () => {
    if (!pending) return;
    const { action, admin } = pending;
    setBusy(true);
    try {
      if (action === "reset") {
        setCredentials(await api<AdminCreatedOut>(`super-admin/admins/${admin.id}/reset-password`, { method: "POST" }));
      } else if (action === "delete") {
        toast.success((await api<MessageOut>(`super-admin/admins/${admin.id}`, { method: "DELETE" })).message);
      } else {
        await api<StaffOut>(`super-admin/admins/${admin.id}/${action}`, { method: "POST" });
        toast.success(action === "suspend" ? `${admin.email} suspended and logged out.` : `${admin.email} can log in again.`);
      }
      setPending(null);
      void invalidate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmText: Record<Action, { title: string; body: string; label: string; danger?: boolean }> = {
    suspend: {
      title: "Suspend admin?",
      body: "They will be logged out immediately and cannot log in until you unsuspend them.",
      label: "Suspend",
      danger: true,
    },
    unsuspend: { title: "Unsuspend admin?", body: "They will be able to log in again.", label: "Unsuspend" },
    reset: {
      title: "Reset password?",
      body: "A new temporary password is generated and their current sessions end. They must set a new password at their next login.",
      label: "Reset password",
    },
    delete: {
      title: "Delete admin?",
      body: "The account is removed and logged out. Their activity log is kept.",
      label: "Delete",
      danger: true,
    },
  };
  const c = pending ? confirmText[pending.action] : null;

  return (
    <>
      <PageHeader title="Admins" description="Admins manage students and elections." actions={<Button onClick={() => setAdding(true)}>Add admin</Button>} />
      <div className="mb-4">
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as typeof status);
            setPage(1);
          }}
          className="sm:w-48"
        >
          <option value="">All admins</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>

      {isPending ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState title="No admins">Add an admin to let them manage students and elections.</EmptyState>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Admin</Th>
                <Th>Status</Th>
                <Th>Last login</Th>
                <Th>Added</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <Td>
                    <p className="font-medium">{a.full_name ?? <span className="text-muted">Pending setup</span>}</p>
                    <p className="text-xs text-muted">{a.email}</p>
                  </Td>
                  <Td>
                    {a.status === "suspended" ? (
                      <Badge tone="danger">Suspended</Badge>
                    ) : a.must_change_password ? (
                      <Badge tone="warning">Awaiting first login</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                  </Td>
                  <Td className="text-muted">{a.last_login_at ? formatWAT(a.last_login_at) : "Never"}</Td>
                  <Td className="text-muted">{formatDate(a.created_at)}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      {a.status === "suspended" ? (
                        <Button variant="ghost" size="sm" onClick={() => setPending({ action: "unsuspend", admin: a })}>
                          Unsuspend
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setPending({ action: "suspend", admin: a })}>
                          Suspend
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setPending({ action: "reset", admin: a })}>
                        Reset password
                      </Button>
                      <Button variant="ghost" size="sm" className="text-danger" onClick={() => setPending({ action: "delete", admin: a })}>
                        Delete
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={50} total={data.total} onPage={setPage} />
        </>
      )}

      <AddAdminDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(created) => {
          setAdding(false);
          setCredentials(created);
          void invalidate();
        }}
      />
      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={run}
        loading={busy}
        danger={c?.danger}
        title={c?.title ?? ""}
        confirmLabel={c?.label}
      >
        <p className="mb-2 font-medium text-foreground">{pending?.admin.email}</p>
        {c?.body}
      </ConfirmDialog>
      <TemporaryPasswordDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}

function AddAdminDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: AdminCreatedOut) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const result = check(z.object({ email: emailSchema }), { email: value });
    setError(result.errors?.email ?? null);
    if (!result.data) return;
    setLoading(true);
    try {
      onCreated(await api<AdminCreatedOut>("super-admin/admins", { json: { email: result.data.email } }));
      setValue("");
    } catch (err) {
      if (err instanceof ApiError && (err.code === "EMAIL_EXISTS" || err.field === "email")) setError(err.message);
      else toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add admin"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={loading}>
            Create admin
          </Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <TextField label="Email" type="email" value={value} onChange={(e) => setValue(e.target.value)} error={error} />
        <p className="text-sm text-muted">
          A temporary password is generated. The admin sets their full name and a new password at their first login.
        </p>
      </form>
    </Dialog>
  );
}

/** Shows a temporary password exactly once; can only be closed deliberately. */
function TemporaryPasswordDialog({ credentials, onClose }: { credentials: AdminCreatedOut | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const close = () => {
    setCopied(false);
    onClose();
  };
  const copy = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(credentials.temporary_password);
      setCopied(true);
      toast.success("Password copied.");
    } catch {
      toast.error("Could not copy. Select the password and copy it manually.");
    }
  };
  return (
    <Dialog
      open={!!credentials}
      onClose={close}
      dismissible={false}
      title="Temporary password"
      footer={<Button onClick={close}>I&apos;ve copied it</Button>}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          Share this with <span className="font-semibold">{credentials?.admin.email}</span>:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 select-all rounded-lg bg-subtle px-4 py-3 text-center font-mono text-lg tracking-wider">
            {credentials?.temporary_password}
          </code>
          <Button variant="secondary" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <Alert tone="warning">This password will not be shown again. Share it securely.</Alert>
      </div>
    </Dialog>
  );
}
