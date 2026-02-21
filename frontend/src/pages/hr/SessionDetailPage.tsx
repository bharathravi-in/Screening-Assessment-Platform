import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { candidateService } from '../../services/candidateService';
import type { SessionDetail, SessionStatus } from '../../types/assessment';

const statusColors: Record<SessionStatus, { bg: string; text: string }> = {
  not_started: { bg: '#6b728020', text: '#6b7280' },
  in_progress: { bg: '#3b82f620', text: '#3b82f6' },
  completed: { bg: '#10b98120', text: '#10b981' },
  terminated: { bg: '#ef444420', text: '#ef4444' },
  timed_out: { bg: '#f59e0b20', text: '#f59e0b' },
};

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await candidateService.getSession(id);
        setSession(data);
      } catch {
        toast.error('Failed to load session');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
        Session not found
      </div>
    );
  }

  const colors = statusColors[session.status] || statusColors.not_started;

  const stats = [
    {
      label: 'Status',
      value: session.status.replace('_', ' '),
      icon: CheckCircle,
      color: colors.text,
    },
    {
      label: 'Score',
      value: session.score_pct != null ? `${session.score_pct.toFixed(1)}%` : '--',
      icon: FileText,
      color: '#3b82f6',
    },
    {
      label: 'Time Remaining',
      value: session.time_remaining_seconds != null
        ? `${Math.floor(session.time_remaining_seconds / 60)}m ${session.time_remaining_seconds % 60}s`
        : '--',
      icon: Clock,
      color: '#f59e0b',
    },
    {
      label: 'Violations',
      value: String(session.proctoring_violations),
      icon: AlertTriangle,
      color: session.proctoring_violations > 0 ? '#ef4444' : '#10b981',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/hr/candidates')}
          className="p-2 rounded-lg"
          style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {session.candidate_name}
            </h1>
            <span
              className="px-3 py-1 rounded-full text-xs font-medium capitalize"
              style={{ backgroundColor: colors.bg, color: colors.text }}
            >
              {session.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {session.candidate_email}
            {session.ip_address && <> &middot; IP: {session.ip_address}</>}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-5"
            style={{
              backgroundColor: 'var(--card-bg)',
              boxShadow: 'var(--card-shadow)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {stat.label}
                </p>
                <p className="text-xl font-bold mt-1 capitalize" style={{ color: 'var(--text-primary)' }}>
                  {stat.value}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: `${stat.color}15` }}>
                <stat.icon size={20} style={{ color: stat.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Timing Info */}
      <div
        className="rounded-xl p-5 mb-6"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          Timing
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Started</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {session.started_at ? new Date(session.started_at).toLocaleString() : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Completed</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {session.completed_at ? new Date(session.completed_at).toLocaleString() : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total Score</p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {session.total_score != null ? `${session.total_score} / ${session.total_max_score}` : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Passed</p>
            <p className="text-sm font-medium" style={{ color: session.is_passed ? 'var(--success)' : session.is_passed === false ? 'var(--danger)' : 'var(--text-primary)' }}>
              {session.is_passed === true ? 'Yes' : session.is_passed === false ? 'No' : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Responses */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Responses ({session.responses.length})
          </h2>
        </div>
        {session.responses.length === 0 ? (
          <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
            No responses recorded
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['#', 'Question ID', 'Submitted', 'Time Spent', 'Score'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold uppercase"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {session.responses.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {i + 1}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                    {r.question_id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: r.is_submitted ? '#10b98120' : '#f59e0b20',
                        color: r.is_submitted ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {r.is_submitted ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {Math.floor(r.time_spent_seconds / 60)}m {r.time_spent_seconds % 60}s
                  </td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {r.final_score != null ? `${r.final_score} / ${r.max_score}` : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Proctoring Log */}
      {session.proctoring_log && session.proctoring_log.length > 0 && (
        <div
          className="rounded-xl overflow-hidden mt-6"
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Proctoring Log
            </h2>
          </div>
          <div className="p-4">
            <pre
              className="text-xs rounded-lg p-4 overflow-auto max-h-64"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              {JSON.stringify(session.proctoring_log, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
