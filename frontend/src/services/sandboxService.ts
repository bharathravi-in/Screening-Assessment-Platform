import axios from 'axios';
import { API_BASE_URL } from '../config/constants';

// Candidate sandbox uses the candidate token from sessionStorage
const candidateSandboxApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

candidateSandboxApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('candidate_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exit_code: number;
  timed_out: boolean;
  execution_time_ms: number;
  error: string | null;
}

export interface TestCaseResult {
  test_case_id: string | null;
  input: string;
  expected_output: string;
  actual_output: string;
  passed: boolean;
  execution_time_ms: number;
  error: string | null;
}

export interface RunTestCasesResponse {
  results: TestCaseResult[];
  total: number;
  passed: number;
  failed: number;
}

export const sandboxService = {
  /** Execute code as a candidate during a test */
  candidateExecute: async (
    code: string,
    language: string,
    stdin: string = ''
  ): Promise<ExecutionResult> => {
    const { data } = await candidateSandboxApi.post('/sandbox/candidate/execute', {
      code,
      language,
      stdin,
    });
    return data;
  },

  /** Run code against test cases as a candidate during a test */
  candidateRunTests: async (
    code: string,
    language: string,
    testCases: { id?: string; input: string; expected_output: string }[]
  ): Promise<RunTestCasesResponse> => {
    const { data } = await candidateSandboxApi.post('/sandbox/candidate/run-tests', {
      code,
      language,
      test_cases: testCases,
    });
    return data;
  },
};
