export interface Question {
  id: string;
  organization_id: string | null;
  created_by_id: string | null;
  type: QuestionType;
  difficulty: DifficultyLevel;
  title: string;
  body: string;
  explanation: string | null;
  time_limit_seconds: number | null;
  max_score: number;
  is_ai_generated: boolean;
  is_active: boolean;
  usage_count: number;
  avg_score_pct: number | null;
  created_at: string;
  updated_at: string;
  options: QuestionOption[];
  test_cases: QuestionTestCase[];
  code_stubs: QuestionCodeStub[];
  tags: { skill_id: string }[];
}

export type QuestionType = 'mcq' | 'multi_select' | 'short_answer' | 'debugging' | 'code_completion' | 'coding' | 'system_design' | 'scenario';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface QuestionOption {
  id: string;
  label: string;
  text: string;
  is_correct: boolean;
  order_index: number;
}

export interface QuestionTestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
  is_sample: boolean;
  order_index: number;
  time_limit_ms: number;
  memory_limit_mb: number;
}

export interface QuestionCodeStub {
  id: string;
  language: string;
  stub_code: string;
  solution_code: string | null;
}
