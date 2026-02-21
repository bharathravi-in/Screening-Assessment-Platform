import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardList, Users, BarChart3, Loader2, Plus } from 'lucide-react';
import { analyticsService } from '../../services/analyticsService';

interface StatCard {
  label: string;
  value: string | number;
  icon: typeof BookOpen;
  color: string;
  href?: string;
}

export default function TechDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([
    { label: 'My Questions', value: '--', icon: BookOpen, color: '#3b82f6', href: '/tech/questions' },
    { label: 'My Assessments', value: '--', icon: ClipboardList, color: '#10b981', href: '/tech/assessments' },
    { label: 'Total Candidates', value: '--', icon: Users, color: '#f59e0b', href: '/tech/candidates' },
    { label: 'Avg Score', value: '--%', icon: BarChart3, color: '#8b5cf6', href: '/tech/analytics' },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await analyticsService.getOverview(30);
        if (!cancelled) {
          setStats((prev) => [
            prev[0], // questions — no API stat yet
            {
              label: 'My Assessments',
              value: data.overview.active_assessments,
              icon: ClipboardList,
              color: '#10b981',
              href: '/tech/assessments',
            },
            {
              label: 'Total Candidates',
              value: data.overview.total_sessions,
              icon: Users,
              color: '#f59e0b',
              href: '/tech/candidates',
            },
            {
              label: 'Avg Score',
              value: data.overview.avg_score_pct != null ? `${data.overview.avg_score_pct}%` : '--',
              icon: BarChart3,
              color: '#8b5cf6',
              href: '/tech/analytics',
            },
          ]);
        }
      } catch {
        // stats stay at defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Tech Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage your questions and assessments
          </p>
        </div>
        <Link
          to="/tech/questions/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus size={16} />
          New Question
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.href ?? '#'}
            className="rounded-xl p-5 border transition hover:opacity-80"
            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {s.label}
              </span>
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${s.color}20` }}
              >
                <s.icon size={18} style={{ color: s.color }} />
              </div>
            </div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {loading ? <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-secondary)' }} /> : s.value}
            </div>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="rounded-xl p-5 border"
          style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Quick Actions
          </h2>
          <div className="space-y-2">
            <Link
              to="/tech/questions/new"
              className="flex items-center gap-2 text-sm p-3 rounded-lg hover:bg-black/5 transition"
              style={{ color: 'var(--text-primary)' }}
            >
              <BookOpen size={16} style={{ color: '#3b82f6' }} />
              Create a new question
            </Link>
            <Link
              to="/tech/assessments/create"
              className="flex items-center gap-2 text-sm p-3 rounded-lg hover:bg-black/5 transition"
              style={{ color: 'var(--text-primary)' }}
            >
              <ClipboardList size={16} style={{ color: '#10b981' }} />
              Build an assessment
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
