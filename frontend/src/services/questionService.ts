import api from '../config/api';
import type { Question } from '../types/question';
import type { QuestionOption, QuestionTestCase, QuestionCodeStub } from '../types/question';

export interface QuestionListParams {
  page?: number;
  page_size?: number;
  type?: string;
  difficulty?: string;
  skill_id?: string;
  search?: string;
  is_active?: boolean;
}

export interface QuestionListResponse {
  questions: Question[];
  total: number;
  page: number;
  page_size: number;
}

export const questionService = {
  async getQuestions(params: QuestionListParams = {}): Promise<QuestionListResponse> {
    const response = await api.get<QuestionListResponse>('/questions/', { params });
    return response.data;
  },

  async getQuestion(id: string): Promise<Question> {
    const response = await api.get<Question>(`/questions/${id}`);
    return response.data;
  },

  async createQuestion(data: Partial<Question>): Promise<Question> {
    const response = await api.post<Question>('/questions/', data);
    return response.data;
  },

  async updateQuestion(id: string, data: Partial<Question>): Promise<Question> {
    const response = await api.put<Question>(`/questions/${id}`, data);
    return response.data;
  },

  async deleteQuestion(id: string): Promise<void> {
    await api.delete(`/questions/${id}`);
  },

  async updateQuestionOptions(id: string, options: Partial<QuestionOption>[]): Promise<void> {
    await api.put(`/questions/${id}/options`, options);
  },

  async updateQuestionTestCases(id: string, testCases: Partial<QuestionTestCase>[]): Promise<void> {
    await api.put(`/questions/${id}/test-cases`, testCases);
  },

  async updateQuestionCodeStubs(id: string, codeStubs: Partial<QuestionCodeStub>[]): Promise<void> {
    await api.put(`/questions/${id}/code-stubs`, codeStubs);
  },
};
