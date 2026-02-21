import api from '../config/api';

export interface ResumeUpload {
  id: string;
  candidate_email: string;
  candidate_name: string | null;
  file_type: string;
  status: string;
  created_at: string;
}

export interface ResumeDetail extends ResumeUpload {
  organization_id: string | null;
  parsed_data: Record<string, unknown> | null;
  matched_skills: Record<string, unknown> | null;
  error_message: string | null;
}

export interface AIGeneratedQuestion {
  type: string;
  difficulty: string;
  title: string;
  body: string;
  explanation: string;
  max_score: number;
  options: Array<{ label: string; text: string; is_correct: boolean; order_index: number }>;
  test_cases: Array<{ input: string; expected_output: string; is_hidden: boolean; is_sample: boolean }>;
  code_stubs: Array<{ language: string; stub_code: string; solution_code: string }>;
  skill_names: string[];
}

export interface AssessmentBlueprint {
  blueprint: Record<string, unknown>;
  jd_analysis: Record<string, unknown>;
  generated_questions: AIGeneratedQuestion[];
}

export interface AIEvaluationResult {
  session_id: string;
  ai_evaluations: Record<string, unknown>;
  proctoring_report: Record<string, unknown>;
  total_score: number;
  total_max_score: number;
  score_pct: number | null;
}

export const aiService = {
  // Resume endpoints
  uploadResume: async (
    file: File,
    candidateEmail: string,
    candidateName?: string
  ): Promise<ResumeUpload> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('candidate_email', candidateEmail);
    if (candidateName) formData.append('candidate_name', candidateName);
    const { data } = await api.post('/resumes/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  listResumes: async (skip = 0, limit = 20): Promise<{ resumes: ResumeUpload[]; total: number }> => {
    const { data } = await api.get('/resumes/', { params: { skip, limit } });
    return data;
  },

  getResume: async (id: string): Promise<ResumeDetail> => {
    const { data } = await api.get(`/resumes/${id}`);
    return data;
  },

  getResumeSkills: async (id: string) => {
    const { data } = await api.get(`/resumes/${id}/skills`);
    return data;
  },

  // AI Question Generation
  generateQuestions: async (
    skills: string[],
    difficulty: string,
    questionType: string,
    count: number
  ): Promise<{ questions: AIGeneratedQuestion[]; count: number }> => {
    const { data } = await api.post('/questions/ai-generate', {
      skills,
      difficulty,
      question_type: questionType,
      count,
    });
    return data;
  },

  // AI Assessment Builder
  buildAssessment: async (
    jobDescription: string,
    questionCount?: number,
    timeLimit?: number,
    difficultyMix?: Record<string, number>
  ): Promise<AssessmentBlueprint> => {
    const { data } = await api.post('/assessments/ai-build', {
      job_description: jobDescription,
      question_count: questionCount,
      time_limit: timeLimit,
      difficulty_mix: difficultyMix,
    });
    return data;
  },

  // AI Evaluation
  evaluateSession: async (
    assessmentId: string,
    sessionId: string
  ): Promise<AIEvaluationResult> => {
    const { data } = await api.post(`/assessments/${assessmentId}/ai-evaluate`, {
      session_id: sessionId,
    });
    return data;
  },

  // AI Generate & Save to Question Bank
  generateAndSaveQuestions: async (
    skills: string[],
    difficulty: string,
    questionType: string,
    count: number
  ): Promise<{ questions: Array<{ id: string; title: string; type: string; difficulty: string }>; count: number; saved_to_bank: boolean }> => {
    const { data } = await api.post('/questions/ai-generate-and-save', {
      skills,
      difficulty,
      question_type: questionType,
      count,
    });
    return data;
  },

  // Resume → Assessment → Invite Pipeline
  createAssessmentFromResume: async (
    resumeId: string,
    options?: {
      title?: string;
      question_count?: number;
      time_limit_minutes?: number;
      send_email?: boolean;
    }
  ): Promise<{
    assessment_id: string;
    assessment_title: string;
    questions_generated: number;
    skills_tested: string[];
    invite_link: string;
    invitation_id: string;
    candidate_email: string;
    candidate_name: string;
  }> => {
    const { data } = await api.post(`/resumes/${resumeId}/create-assessment`, options || {});
    return data;
  },
};
