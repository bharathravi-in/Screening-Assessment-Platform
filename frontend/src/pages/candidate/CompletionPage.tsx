import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Home,
  Trophy,
  User,
  FileText,
  Calendar,
} from 'lucide-react';
import { testService } from '../../services/testService';
import { useTestStore } from '../../store/testStore';
import type { CompletionResponse } from '../../types/test';
import { format } from 'date-fns';

export default function CompletionPage() {
  const navigate = useNavigate();
  const reset = useTestStore((s) => s.reset);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompletionResponse | null>(null);

  useEffect(() => {
    const fetchCompletion = async () => {
      try {
        const result = await testService.getCompletion();
        setData(result);
      } catch (err: any) {
        const detail = err.response?.data?.detail;
        setError(detail || 'Failed to load completion details.');
      } finally {
        setLoading(false);
      }
    };

    fetchCompletion();
  }, []);

  const handleReturnHome = () => {
    reset();
    navigate('/');
  };

  if (loading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ minHeight: 'calc(100vh - 56px)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2
            size={40}
            className="animate-spin"
            style={{ color: 'var(--accent)' }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Loading results...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex-1 flex items-center justify-center px-4"
        style={{ minHeight: 'calc(100vh - 56px)' }}
      >
        <div
          className="w-full max-w-md rounded-xl p-8 text-center"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--card-shadow)',
            border: '1px solid var(--border)',
          }}
        >
          <AlertTriangle
            size={40}
            className="mx-auto mb-4"
            style={{ color: 'var(--danger)' }}
          />
          <h2
            className="text-lg font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Unable to Load Results
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            {error}
          </p>
          <button
            onClick={handleReturnHome}
            className="px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isPassed = data.is_passed;
  const isTerminated = data.status === 'terminated';
  const statusColor = isTerminated
    ? 'var(--danger)'
    : isPassed
      ? '#10b981'
      : isPassed === false
        ? '#ef4444'
        : 'var(--text-muted)';

  const statusLabel = isTerminated
    ? 'Terminated'
    : isPassed
      ? 'Passed'
      : isPassed === false
        ? 'Not Passed'
        : 'Completed';

  const StatusIcon = isTerminated
    ? XCircle
    : isPassed
      ? CheckCircle2
      : isPassed === false
        ? XCircle
        : CheckCircle2;

  return (
    <div
      className="flex-1 flex items-center justify-center px-4 py-8"
      style={{ minHeight: 'calc(100vh - 56px)' }}
    >
      <div
        className="w-full max-w-lg rounded-xl p-8"
        style={{
          backgroundColor: 'var(--card-bg)',
          boxShadow: 'var(--card-shadow)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Status icon and heading */}
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: `${statusColor}15` }}
          >
            <StatusIcon size={36} style={{ color: statusColor }} />
          </div>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            Assessment {statusLabel}
          </h1>
          <p
            className="text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            {isTerminated
              ? 'Your assessment was terminated due to policy violations.'
              : 'Thank you for completing the assessment.'}
          </p>
        </div>

        {/* Score display (conditional) */}
        {data.show_score && data.score_pct !== null && (
          <div
            className="rounded-lg p-5 mb-6 text-center"
            style={{
              backgroundColor: `${statusColor}08`,
              border: `1px solid ${statusColor}40`,
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy size={20} style={{ color: statusColor }} />
              <span
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: statusColor }}
              >
                Your Score
              </span>
            </div>
            <p
              className="text-4xl font-bold"
              style={{ color: statusColor }}
            >
              {Math.round(data.score_pct)}%
            </p>
            {data.total_score !== null && data.total_max_score !== null && (
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--text-muted)' }}
              >
                {data.total_score} / {data.total_max_score} points
              </p>
            )}

            {/* Pass/fail badge */}
            {isPassed !== null && (
              <span
                className="inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase"
                style={{
                  backgroundColor: `${statusColor}20`,
                  color: statusColor,
                }}
              >
                {isPassed ? 'Passed' : 'Not Passed'}
              </span>
            )}
          </div>
        )}

        {/* Details card */}
        <div
          className="rounded-lg p-4 mb-6 flex flex-col gap-3"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3">
            <User size={16} style={{ color: 'var(--text-muted)' }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Candidate
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {data.candidate_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <FileText size={16} style={{ color: 'var(--text-muted)' }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Assessment
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {data.assessment_title}
              </p>
            </div>
          </div>

          {data.completed_at && (
            <div className="flex items-center gap-3">
              <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Completed At
                </p>
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {format(new Date(data.completed_at), 'PPp')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Return home button */}
        <button
          onClick={handleReturnHome}
          className="w-full py-3 rounded-lg text-white font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Home size={16} />
          Return to Home
        </button>
      </div>
    </div>
  );
}
