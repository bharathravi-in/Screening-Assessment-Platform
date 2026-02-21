import type { Question } from './question';

export type AssessmentStatus = 'draft' | 'published' | 'active' | 'closed' | 'archived';
export type InvitationStatus = 'pending' | 'sent' | 'opened' | 'started' | 'completed' | 'expired' | 'cancelled';
export type SessionStatus = 'not_started' | 'in_progress' | 'completed' | 'terminated' | 'timed_out';

export interface Assessment {
  id: string;
  organization_id: string;
  created_by_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  status: AssessmentStatus;
  time_limit_minutes: number | null;
  passing_score_pct: number;
  max_attempts: number;
  is_randomized: boolean;
  is_adaptive: boolean;
  show_score_immediately: boolean;
  proctoring_config: Record<string, unknown> | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssessmentSection {
  id: string;
  title: string;
  description: string | null;
  order_index: number;
  time_limit_minutes: number | null;
}

export interface AssessmentQuestion {
  id: string;
  question_id: string;
  section_id: string | null;
  order_index: number;
  weight: number;
  is_required: boolean;
  question: Question;
}

export interface AssessmentDetail extends Assessment {
  sections: AssessmentSection[];
  assessment_questions: AssessmentQuestion[];
}

export interface AssessmentListResponse {
  assessments: Assessment[];
  total: number;
  page: number;
  page_size: number;
}

export interface CandidateInvitation {
  id: string;
  assessment_id: string;
  organization_id: string;
  invited_by_id: string;
  candidate_email: string;
  candidate_name: string;
  token: string;
  status: InvitationStatus;
  sent_at: string | null;
  opened_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvitationListResponse {
  invitations: CandidateInvitation[];
  total: number;
  page: number;
  page_size: number;
}

export interface CandidateResponseSummary {
  id: string;
  question_id: string;
  is_submitted: boolean;
  time_spent_seconds: number;
  final_score: number | null;
  max_score: number | null;
}

export interface CandidateSession {
  id: string;
  assessment_id: string;
  invitation_id: string;
  organization_id: string;
  candidate_email: string;
  candidate_name: string;
  status: SessionStatus;
  started_at: string | null;
  completed_at: string | null;
  time_remaining_seconds: number | null;
  current_question_index: number;
  total_score: number | null;
  total_max_score: number | null;
  score_pct: number | null;
  is_passed: boolean | null;
  proctoring_violations: number;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionDetail extends CandidateSession {
  responses: CandidateResponseSummary[];
  proctoring_log: unknown[] | null;
}

export interface SessionListResponse {
  sessions: CandidateSession[];
  total: number;
  page: number;
  page_size: number;
}
