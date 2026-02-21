import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, BookOpen, ClipboardList, Loader2 } from 'lucide-react';
import api from '../../config/api';

interface StatCard {
  label: string;
  value: string | number;
  icon: typeof Users;
  color: string;
  href: string;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([
    { label: 'Total Users', value: '--', icon: Users, color: '#3b82f6', href: '/admin/users' },
    { label: 'Organizations', value: '--', icon: Building2, color: '#10b981', href: '/admin/organizations' },
    { label: 'Questions', value: '--', icon: BookOpen, color: '#f59e0b', href: '/admin/questions' },
    { label: 'Assessments', value: '--', icon: ClipboardList, color: '#8b5cf6', href: '/hr/assessments' },
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [usersRes, orgsRes, questionsRes, assessmentsRes] = await Promise.allSettled([
          api.get('/users/', { params: { page: 1, page_size: 1 } }),
          api.get('/organizations/'),
          api.get('/questions/', { params: { page: 1, page_size: 1 } }),
          api.get('/assessments/', { params: { page: 1, page_size: 1 } }),
        ]);
        if (!cancelled) {
          setStats([
            {
              label: 'Total Users',
              value: usersRes.status === 'fulfilled' ? (usersRes.value.data.total ?? '--') : '--',
              icon: Users,
              color: '#3b82f6',
              href: '/admin/users',
            },
            {
              label: 'Organizations',
              value: orgsRes.status === 'fulfilled' ? (orgsRes.value.data.total ?? '--') : '--',
              icon: Building2,
              color: '#10b981',
              href: '/admin/organizations',
            },
            {
              label: 'Questions',
              value: questionsRes.status === 'fulfilled' ? (questionsRes.value.data.total ?? '--') : '--',
              icon: BookOpen,
              color: '#f59e0b',
              href: '/admin/questions',
            },
            {
              label: 'Assessments',
              value: assessmentsRes.status === 'fulfilled' ? (assessmentsRes.value.data.total ?? '--') : '--',
              icon: ClipboardList,
              color: '#8b5cf6',
              href: '/hr/assessments',
            },
          ]);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Admin Dashboard
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.href} to={stat.href} className="block">
            <div
              className="rounded-xl p-5 transition-all hover:shadow-lg cursor-pointer"
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
                <div className="p-3 rounded-lg" style={{ backgroundColor: `${stat.color}15` }}>
                  <stat.icon size={22} style={{ color: stat.color }} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: 'var(--card-bg)',
          boxShadow: 'var(--card-shadow)',
          border: '1px solid var(--border)',
        }}
      >
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Quick Links
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { href: '/admin/users', label: 'Manage Users', color: '#3b82f6' },
            { href: '/admin/organizations', label: 'Manage Organizations', color: '#10b981' },
            { href: '/admin/taxonomy', label: 'Manage Taxonomy', color: '#f59e0b' },
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
