import axios from 'axios';
import { API_BASE_URL } from '../config/constants';
import type {
  TestVerifyResponse,
  TestStartResponse,
  SessionStateResponse,
  ResponseSaveRequest,
  ResponseSaveResponse,
  TestSubmitResponse,
  CompletionResponse,
  ProctoringStatusResponse,
} from '../types/test';

// Separate axios instance for candidate endpoints — uses candidate token, not user token
const testApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

function getToken(): string | null {
  return sessionStorage.getItem('candidate_token');
}

testApi.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const testService = {
  verify: async (token: string): Promise<TestVerifyResponse> => {
    const { data } = await testApi.get(`/test/verify/${token}`);
    return data;
  },

  start: async (invitationToken: string): Promise<TestStartResponse> => {
    const { data } = await testApi.post('/test/start', {
      invitation_token: invitationToken,
    });
    // Store the candidate token for subsequent requests
    sessionStorage.setItem('candidate_token', data.candidate_token);
    return data;
  },

  getSession: async (): Promise<SessionStateResponse> => {
    const { data } = await testApi.get('/test/session');
    return data;
  },

  saveResponse: async (
    questionId: string,
    payload: ResponseSaveRequest
  ): Promise<ResponseSaveResponse> => {
    const { data } = await testApi.post(`/test/response/${questionId}`, payload);
    return data;
  },

  updateResponse: async (
    questionId: string,
    payload: ResponseSaveRequest
  ): Promise<ResponseSaveResponse> => {
    const { data } = await testApi.put(`/test/response/${questionId}`, payload);
    return data;
  },

  navigate: async (questionIndex: number): Promise<void> => {
    await testApi.post('/test/navigate', { question_index: questionIndex });
  },

  submit: async (): Promise<TestSubmitResponse> => {
    const { data } = await testApi.post('/test/submit');
    return data;
  },

  getCompletion: async (): Promise<CompletionResponse> => {
    const { data } = await testApi.get('/test/complete');
    return data;
  },

  reportViolation: async (
    violationType: string,
    details?: string
  ): Promise<ProctoringStatusResponse> => {
    const { data } = await testApi.post('/test/proctoring/violation', {
      violation_type: violationType,
      details,
      timestamp: new Date().toISOString(),
    });
    return data;
  },

  getProctoringStatus: async (): Promise<ProctoringStatusResponse> => {
    const { data } = await testApi.get('/test/proctoring/status');
    return data;
  },

  clearSession: () => {
    sessionStorage.removeItem('candidate_token');
  },
};
