// Mirrors voting-BD/app/models/schemas.py

export type Role = "student" | "admin" | "super_admin";
export type Onboarding = "profile_picture" | "change_password" | null;

export interface TokenOut {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  role: Role;
  onboarding_required: Onboarding;
}

/** What the /api/session/* routes return to the browser (tokens stay in httpOnly cookies). */
export interface SessionOut {
  role: Role;
  onboarding_required: Onboarding;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface MessageOut {
  code: string;
  message: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
}

export type IdType = "matric" | "reg";

export interface StaffOut {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  status: "active" | "suspended";
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
}

export interface AdminCreatedOut {
  admin: StaffOut;
  temporary_password: string;
}

/** Public, so it deliberately has no name or level (it must not reveal who a number belongs to). */
export interface StudentLookupOut {
  identifier: string;
  id_type: IdType;
  /** Masked email the registration code goes to; null when the admin hasn't added one. */
  email_hint: string | null;
}

/** Step 1 of registration: a 6-digit code was emailed to the address on file. */
export interface StudentRegisterStartedOut {
  code: "OTP_SENT";
  message: string;
  /** Send back with the code (and to resend). Only valid for this sign-up attempt. */
  registration_token: string;
  email_hint: string;
  /** Seconds until the code expires. */
  expires_in: number;
  /** Seconds before another code can be requested. */
  resend_in: number;
}

export interface StudentOut {
  id: string;
  identifier: string;
  id_type: IdType;
  full_name: string;
  level: string;
  email: string | null;
  is_registered: boolean;
  /** Paid their dues: only paid students can vote. */
  paid: boolean;
  paid_at: string | null;
  profile_picture_url: string | null;
  created_at: string;
  registered_at: string | null;
}

export interface StudentProfileOut {
  id: string;
  identifier: string;
  id_type: IdType;
  full_name: string;
  level: string;
  email: string | null;
  paid: boolean;
  /** Public pseudonym shown in voter lists instead of the student's real name. */
  unique_name: string | null;
  profile_picture_url: string | null;
  onboarding_required: "profile_picture" | null;
}

export type ImportFormat = "csv" | "xlsx" | "docx" | "pdf";
/** add_email = already on the list without an email; importing fills the email in. */
export type ImportRowStatus = "new" | "add_email" | "exists" | "duplicate" | "invalid";

export interface ImportPreviewRow {
  line: number;
  identifier: string;
  full_name: string;
  email: string | null;
  level: string | null;
  status: ImportRowStatus;
  note: string | null;
}

export interface ImportPreviewOut {
  format: ImportFormat;
  filename: string;
  rows: ImportPreviewRow[];
  counts: Record<ImportRowStatus, number>;
  levels_in_file: string[];
  /** Every readable student in the file is already in the system. */
  already_imported: boolean;
}

export interface StudentBulkDeleteOut {
  deleted: number;
  blocked: { id: string; identifier: string; full_name: string; reason: string }[];
}

export interface BulkImportOut {
  created: number;
  /** Students already on the list whose missing email was filled in. */
  emails_added: number;
  skipped: { line: number; identifier: string; reason: string }[];
  errors: { line: number; identifier: string; error: string }[];
}

export type ElectionStatus = "draft" | "published" | "stopped";
export type ElectionState = "draft" | "upcoming" | "ongoing" | "ended";

export interface CandidateOut {
  id: string;
  full_name: string;
  image_url: string | null;
  /** Set when the candidate was picked from the student list. */
  student_id?: string | null;
  level?: string | null;
}

export interface PositionOut {
  id: string;
  name: string;
  candidates: CandidateOut[];
}

export interface ElectionOut {
  id: string;
  title: string;
  description: string | null;
  status: ElectionStatus;
  state: ElectionState;
  start_time: string;
  end_time: string;
  stopped_at: string | null;
  stop_reason: string | null;
  published_at: string | null;
  positions: PositionOut[];
  created_at: string;
  /** When voting actually closed (stop time or end time); null until the election has ended. */
  closed_at: string | null;
  /** Email the results summary to students automatically when voting ends. */
  auto_share_results: boolean;
  results_share: ResultsShareOut | null;
}

export interface ResultsShareOut {
  status: "sending" | "sent" | "failed";
  /** individual = one email per student; broadcast = one Resend broadcast to the student segment */
  method: "individual" | "broadcast";
  /** broadcast only: syncing contacts to Resend, then sending */
  phase: "syncing" | "sending" | null;
  synced: number;
  sync_todo: number;
  /** Resend's own broadcast status, e.g. queued, sending, sent */
  provider_status: string | null;
  error: string | null;
  requested_at: string;
  requested_by_email: string | null;
  recipients: number;
  sent: number;
  failed: number;
  completed_at: string | null;
}

export interface EmailConfigOut {
  results_delivery: "individual" | "broadcast";
  provider: string;
  configured: boolean;
  /** Who sends registration codes and password resets (e.g. zeptomail, smtp). */
  transactional_provider: string;
}

export interface ShareResultsOut {
  code: string;
  message: string;
  recipients: number;
  election: ElectionOut;
}

export interface ArchivedElectionOut {
  election: ElectionOut;
  total_votes: number;
  eligible_voters: number;
  turnout_percentage: number;
  winners: { position: string; names: string[]; votes: number }[];
}

export interface LevelVotes {
  level: string;
  votes: number;
}

export interface CandidateResult extends CandidateOut {
  votes: number;
  percentage: number;
  /** How many of this candidate's votes came from each level (100, 200, ...), in level order. */
  level_breakdown?: LevelVotes[];
}

/** A voter for one candidate. Only the student's unique name is shown, never their real name. */
export interface CandidateVoterOut {
  unique_name: string;
  level: string;
  voted_at: string;
}

export interface PositionResult {
  id: string;
  name: string;
  /** Already sorted by votes, highest first. */
  candidates: CandidateResult[];
  /** Several ids when tied; empty when nobody has votes. */
  winner_ids: string[];
}

export interface TallyOut {
  election_id: string;
  title: string;
  state: ElectionState;
  total_votes: number;
  eligible_voters: number;
  registered_voters: number;
  turnout_percentage: number;
  positions: PositionResult[];
  updated_at: string;
  source: "live" | "database";
}

export type DashboardState = "no_election" | "upcoming" | "ongoing" | "voted" | "not_paid" | "ended";

export interface DashboardOut {
  state: DashboardState;
  message: string;
  election: ElectionOut | null;
  starts_at: string | null;
  ends_at: string | null;
  results: TallyOut | null;
}

export interface VoteOut {
  code: "VOTE_RECORDED";
  message: string;
  cast_at: string;
}

export interface InboxMessageOut {
  id: string;
  subject: string;
  body: string;
  sender_id: string;
  read: boolean;
  created_at: string;
}

export interface SentMessageOut {
  id: string;
  subject: string;
  body: string;
  recipient_ids: string[];
  read_by: { user_id: string; read_at: string }[];
  created_at: string;
}

export interface AuditLogOut {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_role: Role | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ResetTokenCheckOut {
  valid: boolean;
  full_name: string | null;
  email_hint: string | null;
}

export interface PasswordResetSentOut extends MessageOut {
  email_hint: string;
}

export interface PasswordResetOut extends MessageOut {
  identifier: string;
}

export interface LevelCount {
  level: string;
  count: number;
}

export interface SessionStateOut {
  current: string | null;
  next: string | null;
  started_at: string | null;
  levels: LevelCount[];
  other_levels: LevelCount[];
  total_students: number;
  paid_students: number;
  history: { session: string; started_at: string; started_by_email: string | null; promoted: number; graduated_deleted: number }[];
}

export interface SessionAdvanceOut {
  state: SessionStateOut;
  promoted: number;
  graduated_deleted: number;
}

export type PaidRowStatus = "mark" | "already" | "not_found" | "ambiguous" | "duplicate" | "invalid";

/** Paid lists are matched on names; Matric/Reg numbers in the file are ignored. */
export interface PaidPreviewRow {
  line: number;
  name_in_file: string;
  /** Matric/Reg number of the student the name matched (null when nobody matched). */
  identifier: string | null;
  student_id: string | null;
  student_name: string | null;
  level: string | null;
  /** partial = some names missing or extra; worth a second look before confirming. */
  match: "exact" | "partial" | null;
  status: PaidRowStatus;
  note: string | null;
}

export interface PaidPreviewOut {
  format: ImportFormat;
  filename: string;
  rows: PaidPreviewRow[];
  counts: Record<PaidRowStatus, number>;
}

export interface PaidConfirmOut {
  marked: number;
  already_paid: number;
  not_found: string[];
}
