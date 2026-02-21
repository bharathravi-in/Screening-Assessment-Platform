import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Send,
  XCircle,
  HelpCircle,
  Target,
  Clock,
  Mail,
  CheckCircle,
  AlertCircle,
  Star,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { assessmentService } from '../../services/assessmentService';
import { candidateService } from '../../services/candidateService';
import type { AssessmentDetail, CandidateInvitation, AssessmentStatus, InvitationStatus } from '../../types/assessment';

const statusColors: Record<AssessmentStatus, { bg: string; text: string }> = {
  draft: { bg: '#6b728020', text: '#6b7280' },
  published: { bg: '#3b82f620', text: '#3b82f6' },
  active: { bg: '#10b98120', text: '#10b981' },
  closed: { bg: '#ef444420', text: '#ef4444' },
  archived: { bg: '#6b728020', text: '#6b7280' },
};

const invitationStatusColors: Record<InvitationStatus, { bg: string; text: string }> = {
  pending: { bg: '#f59e0b20', text: '#f59e0b' },
  sent: { bg: '#3b82f620', text: '#3b82f6' },
  opened: { bg: '#3b82f620', text: '#3b82f6' },
  started: { bg: '#10b98120', text: '#10b981' },
  completed: { bg: '#10b98120', text: '#10b981' },
  expired: { bg: '#ef444420', text: '#ef4444' },
  cancelled: { bg: '#6b728020', text: '#6b7280' },
};

const difficultyColors: Record<string, { bg: string; text: string }> = {
  beginner: { bg: '#10b98120', text: '#10b981' },
  intermediate: { bg: '#3b82f620', text: '#3b82f6' },
  advanced: { bg: '#f59e0b20', text: '#f59e0b' },
  expert: { bg: '#ef444420', text: '#ef4444' },
};

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [invitations, setInvitations] = useState<CandidateInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  async function loadData() {
    try {
      setLoading(true);
      const [assessmentData, invitationData] = await Promise.all([
        assessmentService.getAssessment(id!),
        candidateService.getInvitations({ assessment_id: id }),
      ]);
      setAssessment(assessmentData);
      setInvitations(invitationData.invitations);
    } catch (err) {
      toast.error('Failed to load assessment details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (!id) return;
    try {
      setActionLoading(true);
      await assessmentService.publishAssessment(id);
      toast.success('Assessment published successfully');
      await loadData();
    } catch (err) {
      toast.error('Failed to publish assessment');
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClose() {
    if (!id) return;
    try {
      setActionLoading(true);
      await assessmentService.closeAssessment(id);
      toast.success('Assessment closed successfully');
      await loadData();
    } catch (err) {
      toast.error('Failed to close assessment');
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--accent)' }}
        />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-20">
        <AlertCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
          Assessment not found
        </p>
        <Link
          to="/hr/assessments"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ color: 'var(--accent)' }}
        >
          <ArrowLeft size={16} />
          Back to Assessments
        </Link>
      </div>
    );
  }

  const statusStyle = statusColors[assessment.status];

  const statsData = [
    {
      label: 'Total Questions',
      value: assessment.assessment_questions.length,
      icon: HelpCircle,
      color: '#3b82f6',
    },
    {
      label: 'Passing Score',
      value: `${assessment.passing_score_pct}%`,
      icon: Target,
      color: '#10b981',
    },
    {
      label: 'Time Limit',
      value: assessment.time_limit_minutes ? `${assessment.time_limit_minutes} min` : 'No limit',
      icon: Clock,
      color: '#f59e0b',
    },
    {
      label: 'Invitations',
      value: invitations.length,
      icon: Mail,
      color: '#8b5cf6',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/hr/assessments')}
            className="p-2 rounded-lg transition-colors"
            style={{
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1
                className="text-2xl font-bold"
                style={{ color: 'var(--text-primary)' }}
              >
                {assessment.title}
              </h1>
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold uppercase"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                }}
              >
                {assessment.status}
              </span>
            </div>
            {assessment.description && (
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {assessment.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {assessment.status === 'draft' && (
            <>
              <Link
                to={`/hr/assessments/${id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              >
                <Edit size={16} />
                Edit
              </Link>
              <button
                onClick={handlePublish}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
              >
                <Send size={16} />
                Publish
              </button>
            </>
          )}
          {(assessment.status === 'published' || assessment.status === 'active') && (
            <button
              onClick={handleClose}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--danger)',
                color: '#ffffff',
              }}
            >
              <XCircle size={16} />
              Close
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statsData.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-5"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p
                  className="text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {stat.label}
                </p>
                <p
                  className="text-2xl font-bold mt-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {stat.value}
                </p>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: `${stat.color}15` }}
              >
                <stat.icon size={22} style={{ color: stat.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Questions */}
        <div className="lg:col-span-2">
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Questions ({assessment.assessment_questions.length})
            </h2>

            {assessment.assessment_questions.length === 0 ? (
              <div className="text-center py-10">
                <HelpCircle
                  size={40}
                  className="mx-auto mb-3"
                  style={{ color: 'var(--text-muted)' }}
                />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No questions added yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {assessment.assessment_questions
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((aq, index) => {
                    const diffStyle = difficultyColors[aq.question.difficulty] || {
                      bg: '#6b728020',
                      text: '#6b7280',
                    };
                    return (
                      <div
                        key={aq.id}
                        className="flex items-center justify-between p-4 rounded-lg"
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: 'var(--accent)',
                              color: '#ffffff',
                            }}
                          >
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p
                              className="text-sm font-medium truncate"
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {aq.question.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{
                                  backgroundColor: 'var(--accent)',
                                  color: '#ffffff',
                                  opacity: 0.85,
                                }}
                              >
                                {aq.question.type.replace('_', ' ')}
                              </span>
                              <span
                                className="px-2 py-0.5 rounded text-xs font-medium"
                                style={{
                                  backgroundColor: diffStyle.bg,
                                  color: diffStyle.text,
                                }}
                              >
                                {aq.question.difficulty}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <Star size={14} style={{ color: 'var(--text-muted)' }} />
                              <span
                                className="text-xs font-medium"
                                style={{ color: 'var(--text-secondary)' }}
                              >
                                Weight: {aq.weight}
                              </span>
                            </div>
                            {aq.is_required && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <CheckCircle size={12} style={{ color: 'var(--success)' }} />
                                <span
                                  className="text-xs"
                                  style={{ color: 'var(--success)' }}
                                >
                                  Required
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Invitations */}
        <div className="lg:col-span-1">
          <div
            className="rounded-xl p-6"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <h2
              className="text-lg font-semibold mb-4"
              style={{ color: 'var(--text-primary)' }}
            >
              Invitations ({invitations.length})
            </h2>

            {invitations.length === 0 ? (
              <div className="text-center py-10">
                <Mail
                  size={40}
                  className="mx-auto mb-3"
                  style={{ color: 'var(--text-muted)' }}
                />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No candidates invited yet
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {invitations.map((inv) => {
                  const invStyle = invitationStatusColors[inv.status];
                  return (
                    <div
                      key={inv.id}
                      className="p-3 rounded-lg"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {inv.candidate_name}
                        </p>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-2"
                          style={{
                            backgroundColor: invStyle.bg,
                            color: invStyle.text,
                          }}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p
                        className="text-xs truncate"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {inv.candidate_email}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
