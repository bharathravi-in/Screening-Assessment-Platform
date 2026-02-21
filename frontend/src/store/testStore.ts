import { create } from 'zustand';
import { testService } from '../services/testService';
import type {
  TestQuestion,
  TestStartResponse,
  ResponseSaveRequest,
  TestSubmitResponse,
} from '../types/test';

interface ResponseState {
  selected_option_ids?: string[];
  text_response?: string;
  code_response?: string;
  code_language?: string;
  time_spent_seconds: number;
  is_flagged: boolean;
}

interface TestState {
  // Session
  sessionId: string | null;
  status: string;
  invitationToken: string | null;

  // Questions
  questions: TestQuestion[];
  currentQuestionIndex: number;

  // Responses map: question_id -> response state
  responses: Record<string, ResponseState>;

  // Timer
  timeRemaining: number | null;

  // Proctoring
  violations: number;
  maxViolations: number;
  proctoringConfig: Record<string, unknown> | null;

  // Loading
  loading: boolean;

  // Actions
  setInvitationToken: (token: string) => void;
  startTest: (data: TestStartResponse) => void;
  setCurrentQuestion: (index: number) => void;
  updateResponse: (questionId: string, update: Partial<ResponseState>) => void;
  toggleFlag: (questionId: string) => void;
  saveCurrentResponse: (questionId: string) => Promise<void>;
  submitTest: () => Promise<TestSubmitResponse>;
  decrementTimer: () => void;
  addViolation: () => void;
  setTerminated: () => void;
  reset: () => void;
}

export const useTestStore = create<TestState>((set, get) => ({
  sessionId: null,
  status: 'not_started',
  invitationToken: null,
  questions: [],
  currentQuestionIndex: 0,
  responses: {},
  timeRemaining: null,
  violations: 0,
  maxViolations: 5,
  proctoringConfig: null,
  loading: false,

  setInvitationToken: (token) => set({ invitationToken: token }),

  startTest: (data) => {
    const maxViolations =
      (data.proctoring_config?.max_violations as number) ?? 5;

    // Initialize empty responses for all questions
    const responses: Record<string, ResponseState> = {};
    for (const q of data.questions) {
      responses[q.id] = {
        time_spent_seconds: 0,
        is_flagged: false,
      };
    }

    set({
      sessionId: data.session_id,
      status: 'in_progress',
      questions: data.questions.sort((a, b) => a.order_index - b.order_index),
      currentQuestionIndex: 0,
      responses,
      timeRemaining: data.time_remaining_seconds,
      violations: 0,
      maxViolations,
      proctoringConfig: data.proctoring_config,
    });
  },

  setCurrentQuestion: (index) => {
    const { questions } = get();
    if (index >= 0 && index < questions.length) {
      set({ currentQuestionIndex: index });
      testService.navigate(index).catch(() => {});
    }
  },

  updateResponse: (questionId, update) => {
    set((state) => ({
      responses: {
        ...state.responses,
        [questionId]: {
          ...state.responses[questionId],
          ...update,
        },
      },
    }));
  },

  toggleFlag: (questionId) => {
    set((state) => ({
      responses: {
        ...state.responses,
        [questionId]: {
          ...state.responses[questionId],
          is_flagged: !state.responses[questionId]?.is_flagged,
        },
      },
    }));
  },

  saveCurrentResponse: async (questionId) => {
    const response = get().responses[questionId];
    if (!response) return;

    const payload: ResponseSaveRequest = {
      selected_option_ids: response.selected_option_ids,
      text_response: response.text_response,
      code_response: response.code_response,
      code_language: response.code_language,
      time_spent_seconds: response.time_spent_seconds,
      is_flagged: response.is_flagged,
    };

    await testService.saveResponse(questionId, payload);
  },

  submitTest: async () => {
    set({ loading: true });
    try {
      const result = await testService.submit();
      set({ status: 'completed', loading: false });
      return result;
    } catch (e) {
      set({ loading: false });
      throw e;
    }
  },

  decrementTimer: () => {
    set((state) => {
      if (state.timeRemaining === null) return {};
      const newTime = state.timeRemaining - 1;
      if (newTime <= 0) {
        return { timeRemaining: 0 };
      }
      return { timeRemaining: newTime };
    });
  },

  addViolation: () => {
    set((state) => ({
      violations: state.violations + 1,
    }));
  },

  setTerminated: () => {
    set({ status: 'terminated' });
  },

  reset: () => {
    testService.clearSession();
    set({
      sessionId: null,
      status: 'not_started',
      invitationToken: null,
      questions: [],
      currentQuestionIndex: 0,
      responses: {},
      timeRemaining: null,
      violations: 0,
      maxViolations: 5,
      proctoringConfig: null,
      loading: false,
    });
  },
}));
