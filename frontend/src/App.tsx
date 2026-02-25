import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleGuard from './components/auth/RoleGuard';
import AdminLayout from './components/layout/AdminLayout';
import HRLayout from './components/layout/HRLayout';
import TechLayout from './components/layout/TechLayout';
import LoginPage from './pages/auth/LoginPage';
import AdminDashboard from './pages/admin/DashboardPage';
import TaxonomyPage from './pages/admin/TaxonomyPage';
import QuestionBankPage from './pages/admin/QuestionBankPage';
import QuestionFormPage from './pages/admin/QuestionFormPage';
import UsersPage from './pages/admin/UsersPage';
import OrganizationsPage from './pages/admin/OrganizationsPage';
import OrgSettingsPage from './pages/admin/OrgSettingsPage';
import SystemSettingsPage from './pages/admin/SystemSettingsPage';
import BenchmarkingPage from './pages/admin/BenchmarkingPage';
import HRDashboard from './pages/hr/DashboardPage';
import AssessmentListPage from './pages/hr/AssessmentListPage';
import AssessmentFormPage from './pages/hr/AssessmentFormPage';
import AssessmentDetailPage from './pages/hr/AssessmentDetailPage';
import CandidateListPage from './pages/hr/CandidateListPage';
import SessionDetailPage from './pages/hr/SessionDetailPage';
import ResumesPage from './pages/hr/ResumesPage';
import EvaluationPage from './pages/hr/EvaluationPage';
import AnalyticsDashboardPage from './pages/hr/AnalyticsDashboardPage';
import CandidateRankingPage from './pages/hr/CandidateRankingPage';
import TechDashboard from './pages/tech/DashboardPage';
import CandidateLayout from './components/layout/CandidateLayout';
import VerifyPage from './pages/candidate/VerifyPage';
import InstructionsPage from './pages/candidate/InstructionsPage';
import ResumePage from './pages/candidate/ResumePage';
import TestPage from './pages/candidate/TestPage';
import CompletionPage from './pages/candidate/CompletionPage';
import ErrorBoundary from './components/common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            },
          }}
        />

        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            {/* Admin Routes (super_admin + admin) */}
            <Route element={<RoleGuard allowedRoles={['super_admin', 'admin']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<UsersPage />} />
                <Route path="/admin/organizations" element={<OrganizationsPage />} />
                <Route path="/admin/organizations/:orgId/settings" element={<OrgSettingsPage />} />
                <Route path="/admin/org-settings" element={<OrgSettingsPage />} />
                <Route path="/admin/taxonomy" element={<TaxonomyPage />} />
                <Route path="/admin/questions" element={<QuestionBankPage />} />
                <Route path="/admin/questions/new" element={<QuestionFormPage />} />
                <Route path="/admin/questions/:id/edit" element={<QuestionFormPage />} />
                <Route path="/admin/settings" element={<SystemSettingsPage />} />
                <Route path="/admin/benchmarking" element={<BenchmarkingPage />} />
              </Route>
            </Route>

            {/* HR Routes */}
            <Route element={<RoleGuard allowedRoles={['hr']} />}>
              <Route element={<HRLayout />}>
                <Route path="/hr" element={<HRDashboard />} />
                <Route path="/hr/assessments" element={<AssessmentListPage />} />
                <Route path="/hr/assessments/create" element={<AssessmentFormPage />} />
                <Route path="/hr/assessments/:id" element={<AssessmentDetailPage />} />
                <Route path="/hr/assessments/:id/edit" element={<AssessmentFormPage />} />
                <Route path="/hr/candidates" element={<CandidateListPage />} />
                <Route path="/hr/candidates/sessions/:id" element={<SessionDetailPage />} />
                <Route path="/hr/candidates/sessions/:sessionId/evaluation" element={<EvaluationPage />} />
                <Route path="/hr/resumes" element={<ResumesPage />} />
                <Route path="/hr/analytics" element={<AnalyticsDashboardPage />} />
                <Route path="/hr/assessments/:assessmentId/rankings" element={<CandidateRankingPage />} />
              </Route>
            </Route>

            {/* Tech Routes */}
            <Route element={<RoleGuard allowedRoles={['tech']} />}>
              <Route element={<TechLayout />}>
                <Route path="/tech" element={<TechDashboard />} />
                <Route path="/tech/questions" element={<QuestionBankPage />} />
                <Route path="/tech/questions/new" element={<QuestionFormPage />} />
                <Route path="/tech/questions/:id/edit" element={<QuestionFormPage />} />
                <Route path="/tech/assessments" element={<AssessmentListPage />} />
                <Route path="/tech/assessments/create" element={<AssessmentFormPage />} />
                <Route path="/tech/assessments/:id" element={<AssessmentDetailPage />} />
                <Route path="/tech/assessments/:id/edit" element={<AssessmentFormPage />} />
                <Route path="/tech/candidates" element={<CandidateListPage />} />
                <Route path="/tech/candidates/sessions/:id" element={<SessionDetailPage />} />
                <Route path="/tech/candidates/sessions/:sessionId/evaluation" element={<EvaluationPage />} />
                <Route path="/tech/analytics" element={<AnalyticsDashboardPage />} />
                <Route path="/tech/assessments/:assessmentId/rankings" element={<CandidateRankingPage />} />
              </Route>
            </Route>
          </Route>

          {/* Candidate Test-Taking Routes (Public — no ProtectedRoute) */}
          <Route element={<CandidateLayout />}>
            <Route path="/test/verify/:token" element={<VerifyPage />} />
            <Route path="/test/instructions" element={<InstructionsPage />} />
            <Route path="/test/resume" element={<ResumePage />} />
            <Route path="/test/active" element={<TestPage />} />
            <Route path="/test/exam" element={<TestPage />} />
            <Route path="/test/complete" element={<CompletionPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
