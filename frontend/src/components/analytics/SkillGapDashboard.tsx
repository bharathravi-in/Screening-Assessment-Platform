import { useState, useEffect } from 'react';
import {
    BarChart2, TrendingUp, Users, Target,
    Loader2, Calendar,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
} from 'recharts';

interface SkillGapData {
    skill: string;
    avg_score: number;
    assessment_count: number;
    candidate_count: number;
    trend: 'up' | 'down' | 'stable';
}

interface SkillGapDashboardProps {
    organizationId?: string;
}

export default function SkillGapDashboard(_props: SkillGapDashboardProps) {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('30');
    const [skillData, setSkillData] = useState<SkillGapData[]>([]);

    useEffect(() => {
        // Simulated skill gap data — replace with API call when analytics endpoint is extended
        const mockData: SkillGapData[] = [
            { skill: 'JavaScript', avg_score: 72, assessment_count: 15, candidate_count: 45, trend: 'up' },
            { skill: 'Python', avg_score: 68, assessment_count: 12, candidate_count: 38, trend: 'stable' },
            { skill: 'React', avg_score: 65, assessment_count: 10, candidate_count: 32, trend: 'up' },
            { skill: 'SQL', avg_score: 58, assessment_count: 8, candidate_count: 28, trend: 'down' },
            { skill: 'System Design', avg_score: 45, assessment_count: 6, candidate_count: 18, trend: 'down' },
            { skill: 'Docker', avg_score: 52, assessment_count: 5, candidate_count: 15, trend: 'stable' },
            { skill: 'TypeScript', avg_score: 61, assessment_count: 7, candidate_count: 22, trend: 'up' },
            { skill: 'Node.js', avg_score: 55, assessment_count: 6, candidate_count: 20, trend: 'stable' },
        ];
        setSkillData(mockData);
        setLoading(false);
    }, [dateRange]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={20} className="animate-spin" /> Loading skill analytics...
            </div>
        );
    }

    const sortedByScore = [...skillData].sort((a, b) => a.avg_score - b.avg_score);
    const gaps = sortedByScore.filter(s => s.avg_score < 60);
    const strengths = sortedByScore.filter(s => s.avg_score >= 70);

    const pieData = [
        { name: 'Strong (≥70%)', value: strengths.length, color: '#10b981' },
        { name: 'Moderate (50-70%)', value: skillData.filter(s => s.avg_score >= 50 && s.avg_score < 70).length, color: '#f59e0b' },
        { name: 'Gap (<50%)', value: gaps.length, color: '#ef4444' },
    ];

    const heatmapData = skillData.map(s => ({
        name: s.skill,
        score: s.avg_score,
        candidates: s.candidate_count,
        assessments: s.assessment_count,
    }));

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Skill Gap Analytics</h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Organization-wide skill performance analysis</p>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    >
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="365">Last year</option>
                    </select>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Skills Assessed', value: skillData.length, icon: <Target size={20} style={{ color: '#3b82f6' }} />, color: 'rgba(59,130,246,0.1)' },
                    { label: 'Skill Gaps', value: gaps.length, icon: <TrendingUp size={20} style={{ color: '#ef4444' }} />, color: 'rgba(239,68,68,0.1)' },
                    { label: 'Strong Areas', value: strengths.length, icon: <BarChart2 size={20} style={{ color: '#10b981' }} />, color: 'rgba(16,185,129,0.1)' },
                    { label: 'Total Candidates', value: skillData.reduce((s, d) => s + d.candidate_count, 0), icon: <Users size={20} style={{ color: '#8b5cf6' }} />, color: 'rgba(139,92,246,0.1)' },
                ].map((stat, i) => (
                    <div key={i} className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                        <div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                            <p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                        </div>
                        <div className="p-2.5 rounded-lg" style={{ backgroundColor: stat.color }}>{stat.icon}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Skill Performance Bar Chart */}
                <div className="lg:col-span-2 rounded-xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                    <h3 className="text-sm font-semibold uppercase mb-4" style={{ color: 'var(--text-muted)' }}>Average Score by Skill</h3>
                    <div style={{ width: '100%', height: 300 }}>
                        <ResponsiveContainer>
                            <BarChart data={heatmapData} layout="vertical">
                                <XAxis type="number" domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                                    {heatmapData.map((entry, i) => (
                                        <Cell key={i} fill={entry.score >= 70 ? '#10b981' : entry.score >= 50 ? '#f59e0b' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Performance Distribution Pie Chart */}
                <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                    <h3 className="text-sm font-semibold uppercase mb-4" style={{ color: 'var(--text-muted)' }}>Skill Distribution</h3>
                    <div style={{ width: '100%', height: 200 }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={4}>
                                    {pieData.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2">
                        {pieData.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                                </span>
                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Critical Gaps */}
            {gaps.length > 0 && (
                <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                    <h3 className="text-sm font-semibold uppercase mb-4" style={{ color: 'var(--danger)' }}>⚠️ Critical Skill Gaps</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {gaps.map(gap => (
                            <div key={gap.skill} className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{gap.skill}</p>
                                <p className="text-2xl font-bold" style={{ color: 'var(--danger)' }}>{gap.avg_score}%</p>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                    {gap.candidate_count} candidates · {gap.assessment_count} assessments
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
