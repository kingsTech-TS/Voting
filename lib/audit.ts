// Human-readable descriptions of activity-log entries (voting-BD audit_service actions).
import type { AuditLogOut } from "@/lib/api/types";

export type AuditTone = "danger" | "warning" | "success" | "info" | "neutral";
export type AuditCategory = "Sign-in" | "Admins" | "Students" | "Session" | "Elections" | "Ballot" | "Messages";

type Meta = Record<string, unknown>;

interface ActionInfo {
  label: string;
  category: AuditCategory;
  tone: AuditTone;
  /** One sentence describing what happened, without the actor. */
  describe: (m: Meta) => string;
}

const q = (v: unknown) => (v === undefined || v === null || v === "" ? "" : `“${String(v)}”`);
const plural = (n: unknown, word: string) => `${Number(n ?? 0).toLocaleString()} ${word}${Number(n) === 1 ? "" : "s"}`;

export const ACTIONS: Record<string, ActionInfo> = {
  "auth.login": { label: "Signed in", category: "Sign-in", tone: "info", describe: () => "Signed in to the staff console." },
  "auth.login_failed": {
    label: "Failed sign-in",
    category: "Sign-in",
    tone: "danger",
    describe: () => "A sign-in attempt with the wrong password was blocked.",
  },
  "admin.onboarded": {
    label: "Completed setup",
    category: "Admins",
    tone: "success",
    describe: () => "Finished first-time setup and replaced the temporary password.",
  },
  "admin.create": { label: "Admin created", category: "Admins", tone: "success", describe: (m) => `Created an admin account for ${m.email ?? "a new admin"}.` },
  "admin.suspend": { label: "Admin suspended", category: "Admins", tone: "danger", describe: (m) => `Suspended the admin ${m.email ?? ""}`.trim() + "." },
  "admin.unsuspend": { label: "Admin restored", category: "Admins", tone: "success", describe: (m) => `Restored access for ${m.email ?? "an admin"}.` },
  "admin.reset_password": {
    label: "Admin password reset",
    category: "Admins",
    tone: "warning",
    describe: (m) => `Issued a new temporary password for ${m.email ?? "an admin"}.`,
  },
  "admin.delete": { label: "Admin deleted", category: "Admins", tone: "danger", describe: (m) => `Deleted the admin ${m.email ?? ""}`.trim() + "." },
  "student.create": { label: "Student added", category: "Students", tone: "success", describe: (m) => `Added student ${m.identifier ?? ""}`.trim() + "." },
  "student.bulk_import": {
    label: "Students imported",
    category: "Students",
    tone: "success",
    describe: (m) =>
      `Imported ${plural(m.created, "student")} from ${m.filename ? q(m.filename) : "a CSV file"}` +
      (Number(m.skipped) || Number(m.errors) ? ` (${plural(m.skipped, "row")} skipped, ${plural(m.errors, "error")}).` : "."),
  },
  "student.update": {
    label: "Student edited",
    category: "Students",
    tone: "neutral",
    describe: (m) =>
      m.new_identifier
        ? `Changed a student's Matric/Reg number from ${m.old_identifier ?? "?"} to ${m.new_identifier}.`
        : `Updated the details of ${m.identifier ?? "a student"}.`,
  },
  "student.bulk_delete": {
    label: "Students deleted",
    category: "Students",
    tone: "danger",
    describe: (m) => `Deleted ${plural(m.deleted, "student")} and all their data.`,
  },
  "session.set": { label: "Session set", category: "Session", tone: "info", describe: (m) => `Set the current academic session to ${m.session}.` },
  "session.advance": {
    label: "New session started",
    category: "Session",
    tone: "warning",
    describe: (m) =>
      `Started the ${m.to} session: ${plural(m.promoted, "student")} moved up a level and ${plural(m.graduated_deleted, "graduating student")} were deleted.`,
  },
  "student.delete": { label: "Student removed", category: "Students", tone: "danger", describe: (m) => `Removed student ${m.identifier ?? ""}`.trim() + "." },
  "student.reset_registration": {
    label: "Registration reset",
    category: "Students",
    tone: "warning",
    describe: (m) => `Cleared the password and email of ${m.identifier ?? "a student"} so they can register again.`,
  },
  "election.create": { label: "Election created", category: "Elections", tone: "success", describe: (m) => `Created the election ${q(m.title)} as a draft.` },
  "election.update": { label: "Election edited", category: "Elections", tone: "neutral", describe: () => "Changed the election's details." },
  "election.delete": { label: "Election deleted", category: "Elections", tone: "danger", describe: (m) => `Deleted the draft election ${q(m.title)}.` },
  "election.publish": { label: "Election published", category: "Elections", tone: "success", describe: (m) => `Published ${q(m.title)} so students can see it.` },
  "election.unpublish": { label: "Election unpublished", category: "Elections", tone: "warning", describe: (m) => `Moved ${q(m.title)} back to draft.` },
  "election.stop": { label: "Election stopped", category: "Elections", tone: "danger", describe: (m) => `Stopped ${q(m.title)} early.` },
  "election.share_results": {
    label: "Results emailed",
    category: "Elections",
    tone: "success",
    describe: (m) =>
      `${m.resend ? "Re-sent" : "Sent"} the results of ${q(m.title)} to ${plural(m.recipients, "student")} by email` +
      (m.automatic ? " automatically when voting ended." : "."),
  },
  "position.add": { label: "Position added", category: "Ballot", tone: "success", describe: (m) => `Added the position ${q(m.name)}.` },
  "position.rename": { label: "Position renamed", category: "Ballot", tone: "neutral", describe: (m) => `Renamed a position to ${q(m.name)}.` },
  "position.remove": { label: "Position removed", category: "Ballot", tone: "danger", describe: (m) => `Removed the position ${q(m.name)} and its candidates.` },
  "candidate.add": { label: "Candidate added", category: "Ballot", tone: "success", describe: (m) => `Added ${q(m.full_name)} as a candidate.` },
  "candidate.update": {
    label: "Candidate edited",
    category: "Ballot",
    tone: "neutral",
    describe: (m) => `Updated candidate ${q(m.full_name)}${m.image_replaced ? " and replaced their photo" : ""}.`,
  },
  "candidate.remove": { label: "Candidate removed", category: "Ballot", tone: "danger", describe: (m) => `Removed the candidate ${q(m.full_name)}.` },
  "message.send": {
    label: "Message sent",
    category: "Messages",
    tone: "info",
    describe: (m) => `Sent a message${m.subject ? ` ${q(m.subject)}` : ""}${m.recipients !== undefined ? ` to ${plural(m.recipients, "admin")}` : ""}.`,
  },
};

export const CATEGORY_ORDER: AuditCategory[] = ["Sign-in", "Admins", "Students", "Session", "Elections", "Ballot", "Messages"];

function fallbackLabel(action: string): string {
  const [, verb = action] = action.split(".");
  return verb.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function actionInfo(action: string): ActionInfo {
  return (
    ACTIONS[action] ?? {
      label: fallbackLabel(action),
      category: "Elections",
      tone: "neutral",
      describe: () => `Performed “${action}”.`,
    }
  );
}

// ---- metadata fields ------------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  title: "Election",
  description: "Description",
  start_time: "Voting opens",
  end_time: "Voting closes",
  reason: "Reason given",
  name: "Position",
  position_id: "Position ID",
  candidate_id: "Candidate ID",
  full_name: "Name",
  image_replaced: "Photo replaced",
  identifier: "Matric / Reg no.",
  level: "Level",
  email: "Email",
  filename: "File",
  created: "Students added",
  skipped: "Rows skipped",
  errors: "Rows with errors",
  recipients: "Recipients",
  resend: "Re-send",
  subject: "Subject",
  to_all: "Sent to all admins",
  automatic: "Sent automatically",
  new_identifier: "New Matric / Reg no.",
  old_identifier: "Previous Matric / Reg no.",
  new_full_name: "New name",
  old_full_name: "Previous name",
  new_level: "New level",
  old_level: "Previous level",
  identifiers: "Matric / Reg numbers",
  deleted: "Students deleted",
  blocked: "Not deleted",
  from: "Previous session",
  to: "New session",
  session: "Session",
  promoted: "Moved up a level",
  graduated_deleted: "Graduates deleted",
  format: "File type",
};

// Shown last (and in monospace) because they are only useful for cross-referencing.
const TECHNICAL = new Set(["position_id", "candidate_id"]);

const DATE_KEYS = new Set(["start_time", "end_time"]);

export interface DetailField {
  key: string;
  label: string;
  value: unknown;
  kind: "text" | "date" | "bool" | "number" | "id" | "long" | "list";
}

export function detailFields(metadata: Meta): DetailField[] {
  const fields: DetailField[] = Object.entries(metadata)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([key, value]) => {
      const label = FIELD_LABELS[key] ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
      let kind: DetailField["kind"] = "text";
      if (DATE_KEYS.has(key)) kind = "date";
      else if (typeof value === "boolean") kind = "bool";
      else if (typeof value === "number") kind = "number";
      else if (Array.isArray(value)) kind = "list";
      else if (TECHNICAL.has(key) || key.endsWith("_id")) kind = "id";
      else if (typeof value === "string" && value.length > 80) kind = "long";
      return { key, label, value, kind };
    });
  return fields.sort((a, b) => Number(a.kind === "id") - Number(b.kind === "id"));
}

/** Python's str(datetime) uses a space; make it ISO so Date can parse it everywhere. */
export function parseLoggedDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const iso = v.includes("T") ? v : v.replace(" ", "T");
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

// ---- user agent -----------------------------------------------------------------------------------

export function describeDevice(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\/|Opera/.test(ua) ? "Opera" :
    /SamsungBrowser/.test(ua) ? "Samsung Internet" :
    /Chrome\//.test(ua) && !/Chromium/.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) && /Version\//.test(ua) ? "Safari" :
    /node|undici|python|curl|httpx/i.test(ua) ? "Server / script" :
    null;
  const os =
    /Windows NT/.test(ua) ? "Windows" :
    /iPhone|iPad|iPod/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /CrOS/.test(ua) ? "ChromeOS" :
    /Linux/.test(ua) ? "Linux" :
    null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "Unknown device";
}

export function roleLabel(role: AuditLogOut["actor_role"]): string {
  if (role === "super_admin") return "Super admin";
  if (role === "admin") return "Admin";
  if (role === "student") return "Student";
  return "System";
}
