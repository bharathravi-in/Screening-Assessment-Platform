import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  ClipboardList,
  CheckCircle,
  TrendingUp,
  Award,
  Loader2,
} from 'lucide-react';
import { analyticsService, type AnalyticsOverview } from '../../services/analyticsService';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

const TIME_RANGE_OPTIONS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 365 days', value: 365 },
];

const tooltipContentStyle: React.CSSProperties = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--text-primary)',
  boxShadow: 'var(--card-shadow)',
};

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [days, setDays] = useState<number>(30);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await analyticsService.getOverview(days);
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error('Failed to load analytics data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2
          className="animate-spin"
          size={40}
          style={{ color: 'var(--accent)' }}
        />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { overview, score_distribution, session_statuses, invitation_statuses, top_assessments, difficulty_performance, type_performance, daily_sessions } = data;

  const statCards = [
    {
      label: 'Total Assessments',
      value: overview.total_assessments,
      icon: ClipboardList,
      color: '#3b82f6',
    },
    {
      label: 'Completed Sessions',
      value: overview.completed_sessions,
      icon: CheckCircle,
      color: '#10b981',
    },
    {
      label: 'Avg Score',
      value: overview.avg_score_pct !== null ? `${overview.avg_score_pct.toFixed(1)}%` : '--',
      icon: TrendingUp,
      color: '#f59e0b',
    },
    {
      label: 'Pass Rate',
      value: overview.pass_rate !== null ? `${overview.pass_rate.toFixed(1)}%` : '--',
      icon: Award,
      color: '#8b5cf6',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--text-primary)' }}
        >
          Analytics
        </h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          }}
        >
          {TIME_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
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

      {/* Daily Sessions Line Chart */}
      <div
        className="rounded-xl p-6 mb-8"
        style={{
          backgroundColor: 'var(--card-bg)',
          boxShadow: 'var(--card-shadow)',
          border: '1px solid var(--border)',
        }}
      >
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Daily Sessions
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={daily_sessions}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              stroke="var(--border)"
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              stroke="var(--border)"
              allowDecimals={false}
            />
            <Tooltip contentStyle={tooltipContentStyle} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ fill: 'var(--accent)', r: 3 }}
              activeDot={{ r: 5 }}
              name="Sessions"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Score Distribution Bar Chart */}
      <div
        className="rounded-xl p-6 mb-8"
        style={{
          backgroundColor: 'var(--card-bg)',
          boxShadow: 'var(--card-shadow)',
          border: '1px solid var(--border)',
        }}
      >
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Score Distribution
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={score_distribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="range"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              stroke="var(--border)"
            />
            <YAxis
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              stroke="var(--border)"
              allowDecimals={false}
            />
            <Tooltip contentStyle={tooltipContentStyle} />
            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Count" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Side-by-side Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Session Status Pie Chart */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--card-shadow)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Session Status
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={session_statuses}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(props) => {
                  const p = props as unknown as { status: string; count: number };
                  return `${p.status} (${p.count})`;
                }}
              >
                {session_statuses.map((_entry, index) => (
                  <Cell key={`session-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipContentStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Invitation Status Pie Chart */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--card-shadow)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Invitation Status
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={invitation_statuses}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(props) => {
                  const p = props as unknown as { status: string; count: number };
                  return `${p.status} (${p.count})`;
                }}
              >
                {invitation_statuses.map((_entry, index) => (
                  <Cell key={`invitation-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipContentStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Assessments Table */}
      <div
        className="rounded-xl p-6 mb-8 overflow-x-auto"
        style={{
          backgroundColor: 'var(--card-bg)',
          boxShadow: 'var(--card-shadow)',
          border: '1px solid var(--border)',
        }}
      >
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Top Assessments
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th
                className="text-left py-3 px-4 font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Assessment ID
              </th>
              <th
                className="text-left py-3 px-4 font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Title
              </th>
              <th
                className="text-right py-3 px-4 font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Sessions
              </th>
              <th
                className="text-right py-3 px-4 font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Completions
              </th>
              <th
                className="text-right py-3 px-4 font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Avg Score
              </th>
              <th
                className="text-right py-3 px-4 font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Pass Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {top_assessments.map((assessment) => (
              <tr
                key={assessment.assessment_id}
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <td
                  className="py-3 px-4 font-mono text-xs"
                  style={{ color: 'var(--text-muted)' }}
                  title={assessment.assessment_id}
                >
                  {assessment.assessment_id.slice(0, 8)}...
                </td>
                <td
                  className="py-3 px-4"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {assessment.title}
                </td>
                <td
                  className="py-3 px-4 text-right"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {assessment.sessions}
                </td>
                <td
                  className="py-3 px-4 text-right"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {assessment.completions}
                </td>
                <td
                  className="py-3 px-4 text-right"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {assessment.avg_score !== null ? `${assessment.avg_score.toFixed(1)}%` : '--'}
                </td>
                <td
                  className="py-3 px-4 text-right"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {assessment.pass_rate !== null ? `${assessment.pass_rate.toFixed(1)}%` : '--'}
                </td>
              </tr>
            ))}
            {top_assessments.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center"
                  style={{ color: 'var(--text-muted)' }}
                >
                  No assessment data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Side-by-side Performance Bar Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Difficulty Performance */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--card-shadow)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Difficulty Performance
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={difficulty_performance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="difficulty"
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                stroke="var(--border)"
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                stroke="var(--border)"
                domain={[0, 100]}
              />
              <Tooltip contentStyle={tooltipContentStyle} />
              <Bar
                dataKey="avg_score_pct"
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                name="Avg Score %"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Question Type Performance */}
        <div
          className="rounded-xl p-6"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--card-shadow)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            className="text-lg font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Question Type Performance
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={type_performance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="question_type"
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                stroke="var(--border)"
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                stroke="var(--border)"
                domain={[0, 100]}
              />
              <Tooltip contentStyle={tooltipContentStyle} />
              <Bar
                dataKey="avg_score_pct"
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                name="Avg Score %"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
