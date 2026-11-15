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

export interface StudentLookupOut {
  identifier: string;
  id_type: IdType;
  full_name: string;
  level: string;
}

export interface StudentOut {
  id: string;
  identifier: string;
  id_type: IdType;
  full_name: string;
  level: string;
  is_registered: boolean;
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
  profile_picture_url: string | null;
  onboarding_required: "profile_picture" | null;
}

export interface BulkImportOut {
  created: number;
  skipped: { line: number; identifier: string; reason: string }[];
  errors: { line: number; identifier: string; error: string }[];
}

export type ElectionStatus = "draft" | "published" | "stopped";
export type ElectionState = "draft" | "upcoming" | "ongoing" | "ended";

export interface CandidateOut {
  id: string;
  full_name: string;
  image_url: string | null;
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
}

export interface CandidateResult extends CandidateOut {
  votes: number;
  percentage: number;
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

export type DashboardState = "no_election" | "upcoming" | "ongoing" | "voted" | "ended";

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
  created_at: string;
}
