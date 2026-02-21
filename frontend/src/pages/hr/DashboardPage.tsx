import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Users, BarChart3, FileText, Loader2, Plus } from 'lucide-react';
import { analyticsService } from '../../services/analyticsService';

interface StatCard {
  label: string;
  value: string | number;
  icon: typeof ClipboardList;
  color: string;
  href?: string;
}

export default function HRDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([
    { label: 'Active Assessments', value: '--', icon: ClipboardList, color: '#3b82f6', href: '/hr/assessments' },
    { label: 'Total Candidates', value: '--', icon: Users, color: '#10b981', href: '/hr/candidates' },
    { label: 'Resumes Parsed', value: '--', icon: FileText, color: '#f59e0b', href: '/hr/resumes' },
    { label: 'Avg Score', value: '--%', icon: BarChart3, color: '#8b5cf6', href: '/hr/analytics' },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await analyticsService.getOverview(30);
        if (!cancelled) {
          setStats([
            {
              label: 'Active Assessments',
              value: data.overview.active_assessments,
              icon: ClipboardList,
              color: '#3b82f6',
              href: '/hr/assessments',
            },
            {
              label: 'Total Candidates',
              value: data.overview.total_sessions,
              icon: Users,
              color: '#10b981',
              href: '/hr/candidates',
            },
            {
              label: 'Completion Rate',
              value: `${data.overview.completion_rate.toFixed(1)}%`,
              icon: FileText,
              color: '#f59e0b',
              href: '/hr/analytics',
            },
            {
              label: 'Avg Score',
              value: data.overview.avg_score_pct != null ? `${data.overview.avg_score_pct}%` : '--',
              icon: BarChart3,
              color: '#8b5cf6',
              href: '/hr/analytics',
            },
          ]);
        }
      } catch {
        // Keep placeholder values on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          HR Dashboard
        </h1>
        <Link
          to="/hr/assessments/create"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus size={16} />
          New Assessment
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Inner = (
            <div
              className="rounded-xl p-5 transition-shadow hover:shadow-lg"
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
                  <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                    {loading ? <Loader2 size={20} className="animate-spin inline" /> : stat.value}
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
          );
          return stat.href ? (
            <Link key={stat.label} to={stat.href} className="block">
              {Inner}
            </Link>
          ) : (
            <div key={stat.label}>{Inner}</div>
          );
        })}
      </div>

      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: 'var(--card-bg)',
          boxShadow: 'var(--card-shadow)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Quick Actions
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/hr/assessments/create', label: 'Create Assessment', color: '#3b82f6' },
            { href: '/hr/resumes', label: 'Parse Resume', color: '#f59e0b' },
            { href: '/hr/analytics', label: 'View Analytics', color: '#8b5cf6' },
          ].map((action) => (
            <Link
              key={action.href}
              to={action.href}
              className="flex items-center justify-center gap-2 p-4 rounded-xl text-sm font-medium transition-all hover:opacity-90"
              style={{
                backgroundColor: `${action.color}12`,
                color: action.color,
                border: `1px solid ${action.color}25`,
              }}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
