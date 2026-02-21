import api from '../config/api';
import type {
  Assessment,
  AssessmentDetail,
  AssessmentListResponse,
  AssessmentSection,
  AssessmentQuestion,
} from '../types/assessment';

export interface AssessmentListParams {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}

export interface AssessmentCreateData {
  title: string;
  description?: string;
  instructions?: string;
  time_limit_minutes?: number;
  passing_score_pct?: number;
  max_attempts?: number;
  is_randomized?: boolean;
  is_adaptive?: boolean;
  show_score_immediately?: boolean;
  proctoring_config?: Record<string, unknown>;
  scheduled_start?: string;
  scheduled_end?: string;
}

export interface AddQuestionData {
  question_id: string;
  section_id?: string;
  order_index?: number;
  weight?: number;
  is_required?: boolean;
}

export const assessmentService = {
  async getAssessments(params: AssessmentListParams = {}): Promise<AssessmentListResponse> {
    const response = await api.get<AssessmentListResponse>('/assessments/', { params });
    return response.data;
  },

  async getAssessment(id: string): Promise<AssessmentDetail> {
    const response = await api.get<AssessmentDetail>(`/assessments/${id}`);
    return response.data;
  },

  async createAssessment(data: AssessmentCreateData): Promise<Assessment> {
    const response = await api.post<Assessment>('/assessments/', data);
    return response.data;
  },

  async updateAssessment(id: string, data: Partial<AssessmentCreateData>): Promise<Assessment> {
    const response = await api.put<Assessment>(`/assessments/${id}`, data);
    return response.data;
  },

  async deleteAssessment(id: string): Promise<void> {
    await api.delete(`/assessments/${id}`);
  },

  async publishAssessment(id: string): Promise<Assessment> {
    const response = await api.post<Assessment>(`/assessments/${id}/publish`);
    return response.data;
  },

  async closeAssessment(id: string): Promise<Assessment> {
    const response = await api.post<Assessment>(`/assessments/${id}/close`);
    return response.data;
  },

  async addSection(assessmentId: string, data: { title: string; description?: string; order_index?: number; time_limit_minutes?: number }): Promise<AssessmentSection> {
    const response = await api.post<AssessmentSection>(`/assessments/${assessmentId}/sections`, data);
    return response.data;
  },

  async updateSection(assessmentId: string, sectionId: string, data: Partial<AssessmentSection>): Promise<AssessmentSection> {
    const response = await api.put<AssessmentSection>(`/assessments/${assessmentId}/sections/${sectionId}`, data);
    return response.data;
  },

  async deleteSection(assessmentId: string, sectionId: string): Promise<void> {
    await api.delete(`/assessments/${assessmentId}/sections/${sectionId}`);
  },

  async addQuestion(assessmentId: string, data: AddQuestionData): Promise<AssessmentQuestion> {
    const response = await api.post<AssessmentQuestion>(`/assessments/${assessmentId}/questions`, data);
    return response.data;
  },

  async updateQuestion(assessmentId: string, aqId: string, data: Partial<AddQuestionData>): Promise<AssessmentQuestion> {
    const response = await api.put<AssessmentQuestion>(`/assessments/${assessmentId}/questions/${aqId}`, data);
    return response.data;
  },

  async removeQuestion(assessmentId: string, aqId: string): Promise<void> {
    await api.delete(`/assessments/${assessmentId}/questions/${aqId}`);
  },

  async reorderQuestions(assessmentId: string, items: { id: string; order_index: number }[]): Promise<void> {
    await api.post(`/assessments/${assessmentId}/questions/reorder`, items);
  },
};
