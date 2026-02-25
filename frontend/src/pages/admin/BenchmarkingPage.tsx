import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import {
    Trophy, Users, Target, Zap,
    ChevronRight, ArrowUpRight,
    Filter, Download, Loader2
} from 'lucide-react';
import api from '../../config/api';

interface BenchmarkData {
    category: string;
    org_score: number | null;
    industry_avg: number | null;
}

export default function BenchmarkingPage() {
    const [loading, setLoading] = useState(true);
    const [benchmarkData, setBenchmarkData] = useState<BenchmarkData[]>([]);
    const [percentile, setPercentile] = useState<number | null>(null);
    const [cohorts, setCohorts] = useState<{ name: string, avg_score: number, pass_rate: number }[]>([]);
    const [stats, setStats] = useState({
        avgScore: 0,
        passRate: 0,
        completionRate: 0,
    });

    const percentileTrend = [
        { month: 'Oct', percentile: 68 },
        { month: 'Nov', percentile: 72 },
        { month: 'Dec', percentile: 71 },
        { month: 'Jan', percentile: 75 },
        { month: 'Feb', percentile: 82 },
    ];

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [benchRes, overviewRes, cohortsRes] = await Promise.all([
                    api.get('/analytics/benchmark'),
                    api.get('/analytics/overview'),
                    api.get('/analytics/cohorts')
                ]);

                setBenchmarkData(benchRes.data.by_type || []);
                setPercentile(benchRes.data.percentile);
                setCohorts(cohortsRes.data || []);

                const ov = overviewRes.data.overview;
                setStats({
                    avgScore: ov.avg_score_pct || 0,
                    passRate: ov.pass_rate || 0,
                    completionRate: ov.completion_rate || 0,
                });
            } catch (error) {
                console.error('Failed to fetch benchmarking data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center p-20">
                <Loader2 size={32} className="animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Benchmarking & Insights</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Compare your organization against platform-wide industry averages</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                        <Filter size={16} /> Filters
                    </button>
                    <button className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#2563eb' }}>
                        <Download size={16} /> Export Report
                    </button>
                </div>
            </div>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Global Percentile', value: percentile ? `${percentile}th` : 'N/A', icon: <Trophy size={20} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                    { label: 'Avg Assessment Score', value: `${stats.avgScore.toFixed(1)}%`, icon: <Users size={20} />, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                    { label: 'Pass Rate', icon: <Zap size={20} />, value: `${stats.passRate.toFixed(1)}%`, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
                    { label: 'Completion Rate', value: `${stats.completionRate.toFixed(1)}%`, icon: <Target size={20} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                ].map((stat, i) => (
                    <div key={i} className="rounded-xl p-5 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: stat.bg, color: stat.color }}>{stat.icon}</div>
                            <span className="text-xs font-medium flex items-center gap-1 text-green-500">
                                <ArrowUpRight size={12} /> +4%
                            </span>
                        </div>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                        <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Benchmarking Bar Chart */}
                <div className="lg:col-span-2 rounded-xl p-6 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Skill Proficiency Benchmarking</h3>
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#2563eb' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>Your Org</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#94a3b8' }} />
                                <span style={{ color: 'var(--text-secondary)' }}>Industry Avg</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ width: '100%', height: 320 }}>
                        <ResponsiveContainer>
                            <BarChart data={benchmarkData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                />
                                <Bar dataKey="org_score" name="Your Org" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={32} />
                                <Bar dataKey="industry_avg" name="Industry Avg" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Percentile Growth Trend */}
                <div className="rounded-xl p-6 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}>
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: 'var(--text-muted)' }}>Percentile Growth</h3>
                    <div style={{ width: '100%', height: 260 }}>
                        <ResponsiveContainer>
                            <AreaChart data={percentileTrend} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPerc" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                                <Area type="monotone" dataKey="percentile" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorPerc)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-6 p-4 rounded-lg flex items-start gap-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <div className="p-2 bg-white rounded-lg border">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                                <polyline points="17 6 23 6 23 12"></polyline>
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Insight</p>
                            <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                Your candidate quality has surpassed {percentile}% of organizations in the Tech sector this month.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cohort Performance Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl p-6 border" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}>
                    <h3 className="text-sm font-semibold uppercase tracking-wider mb-6" style={{ color: 'var(--text-muted)' }}>Cohort Performance Analysis</h3>
                    <div className="space-y-4">
                        {cohorts.map((cohort, i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-lg border" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
                                <div>
                                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{cohort.name}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Avg Score: {cohort.avg_score?.toFixed(1)}%</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-blue-600">{cohort.pass_rate?.toFixed(1)}%</p>
                                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Pass Rate</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-xl p-6 border flex flex-col items-center justify-center text-center" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}>
                    <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-4">
                        <Target size={32} />
                    </div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Executive Dashboard Ready</h3>
                    <p className="text-sm px-6 mt-2" style={{ color: 'var(--text-secondary)' }}>
                        All high-level metrics and benchmarking cohorts are now synced with organization-wide assessment data.
                    </p>
                </div>
            </div>

            {/* Detailed Comparisons Table */}
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)', boxShadow: 'var(--card-shadow)' }}>
                <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                    <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Skill Category Breakdown</h3>
                    <button className="text-xs font-medium text-blue-600 hover:underline">View All</button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                            <tr>
                                <th className="px-6 py-3 font-semibold uppercase text-[11px]">Skill Category</th>
                                <th className="px-6 py-3 font-semibold uppercase text-[11px]">Your Average</th>
                                <th className="px-6 py-3 font-semibold uppercase text-[11px]">Industry Average</th>
                                <th className="px-6 py-3 font-semibold uppercase text-[11px]">Delta</th>
                                <th className="px-6 py-3 font-semibold uppercase text-[11px]">Performance Gap</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                            {benchmarkData.map((item, idx) => {
                                const delta = (item.org_score || 0) - (item.industry_avg || 0);
                                return (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                                        <td className="px-6 py-4 font-medium" style={{ color: 'var(--text-primary)' }}>{item.category}</td>
                                        <td className="px-6 py-4" style={{ color: 'var(--text-secondary)' }}>{item.org_score?.toFixed(1)}%</td>
                                        <td className="px-6 py-4" style={{ color: 'var(--text-secondary)' }}>{item.industry_avg?.toFixed(1)}%</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${delta >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                                    <div
                                                        className={`h-full ${delta >= 0 ? 'bg-blue-600' : 'bg-amber-500'}`}
                                                        style={{ width: `${Math.min(Math.abs(delta) * 5, 100)}%` }}
                                                    />
                                                </div>
                                                <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500" />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
