export const API_BASE_URL = '/api/v1';

export const ROUTES = {
  // Public
  LOGIN: '/login',
  REGISTER: '/register',

  // Candidate (token-based)
  CANDIDATE_VERIFY: '/test/verify/:token',
  CANDIDATE_INSTRUCTIONS: '/test/instructions',
  CANDIDATE_RESUME: '/test/resume',
  CANDIDATE_TEST: '/test/active',
  CANDIDATE_COMPLETE: '/test/complete',

  // Admin
  ADMIN_DASHBOARD: '/admin',
  ADMIN_USERS: '/admin/users',
  ADMIN_ORGS: '/admin/organizations',
  ADMIN_TAXONOMY: '/admin/taxonomy',
  ADMIN_QUESTIONS: '/admin/questions',
  ADMIN_POLICIES: '/admin/policies',
  ADMIN_SETTINGS: '/admin/settings',

  // HR
  HR_DASHBOARD: '/hr',
  HR_ASSESSMENTS: '/hr/assessments',
  HR_CREATE_ASSESSMENT: '/hr/assessments/create',
  HR_EDIT_ASSESSMENT: '/hr/assessments/:id/edit',
  HR_CANDIDATES: '/hr/candidates',
  HR_EVALUATION: '/hr/evaluations/:sessionId',
  HR_ANALYTICS: '/hr/analytics',
  HR_RESUMES: '/hr/resumes',
} as const;
