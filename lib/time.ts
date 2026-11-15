// All times are shown in West Africa Time, matching the backend's messages.
export const DISPLAY_TZ = process.env.NEXT_PUBLIC_DISPLAY_TZ || "Africa/Lagos";
/** Africa/Lagos is UTC+1 all year (no daylight saving). */
const WAT_OFFSET = "+01:00";
const WAT_OFFSET_MS = 60 * 60 * 1000;

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatWAT(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${dateTimeFmt.format(new Date(iso))} WAT`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dateFmt.format(new Date(iso));
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return timeFmt.format(new Date(iso));
}

/** `datetime-local` value (interpreted as WAT) → timezone-aware ISO string. */
export function toAwareISO(localValue: string): string {
  const v = localValue.length === 16 ? `${localValue}:00` : localValue;
  return `${v}${WAT_OFFSET}`;
}

/** ISO string → `datetime-local` value in WAT. */
export function toLocalInput(iso: string): string {
  const d = new Date(new Date(iso).getTime() + WAT_OFFSET_MS);
  return d.toISOString().slice(0, 16);
}

// ---- server clock skew ------------------------------------------------------------------------
let skewMs = 0;

/** Called by the API client with each response's Date header. */
export function noteServerDate(header: string | null): void {
  if (!header) return;
  const server = Date.parse(header);
  if (!Number.isNaN(server)) skewMs = server - Date.now();
}

/** Best guess of the server's current time (epoch ms). */
export function serverNow(): number {
  return Date.now() + skewMs;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
