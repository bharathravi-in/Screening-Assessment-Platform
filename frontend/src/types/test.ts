export interface TestQuestionOption {
  id: string;
  label: string;
  text: string;
  order_index: number;
}

export interface TestQuestionCodeStub {
  language: string;
  stub_code: string;
}

export interface TestQuestionTestCase {
  id: string;
  input: string;
  expected_output: string;
  order_index: number;
}

export interface TestQuestion {
  id: string;
  assessment_question_id: string;
  type: string;
  difficulty: string;
  title: string;
  body: string;
  time_limit_seconds: number | null;
  max_score: number;
  order_index: number;
  weight: number;
  options: TestQuestionOption[];
  code_stubs: TestQuestionCodeStub[];
  test_cases: TestQuestionTestCase[];
}

export interface TestVerifyResponse {
  invitation_id: string;
  assessment_id: string;
  assessment_title: string;
  assessment_description: string | null;
  assessment_instructions: string | null;
  time_limit_minutes: number | null;
  total_questions: number;
  candidate_name: string;
  candidate_email: string;
  status: string;
  proctoring_enabled: boolean;
  proctoring_config: Record<string, unknown> | null;
}

export interface TestStartResponse {
  session_id: string;
  candidate_token: string;
  time_remaining_seconds: number | null;
  questions: TestQuestion[];
  proctoring_config: Record<string, unknown> | null;
}

export interface SessionStateResponse {
  session_id: string;
  status: string;
  current_question_index: number;
  time_remaining_seconds: number | null;
  total_questions: number;
  answered_count: number;
  flagged_count: number;
  proctoring_violations: number;
}

export interface ResponseSaveRequest {
  selected_option_ids?: string[] | null;
  text_response?: string | null;
  code_response?: string | null;
  code_language?: string | null;
  time_spent_seconds?: number;
  is_flagged?: boolean;
}

export interface ResponseSaveResponse {
  response_id: string;
  question_id: string;
  is_submitted: boolean;
  saved_at: string;
}

export interface TestSubmitResponse {
  session_id: string;
  status: string;
  total_score: number | null;
  total_max_score: number | null;
  score_pct: number | null;
  is_passed: boolean | null;
  show_score: boolean;
  message: string;
}

export interface CompletionResponse {
  session_id: string;
  candidate_name: string;
  assessment_title: string;
  status: string;
  total_score: number | null;
  total_max_score: number | null;
  score_pct: number | null;
  is_passed: boolean | null;
  show_score: boolean;
  completed_at: string | null;
}

export interface ProctoringStatusResponse {
  violations: number;
  max_violations: number;
  warnings_remaining: number;
  is_terminated: boolean;
}
