import { useState, useEffect } from 'react';
import {
    TrendingUp, TrendingDown, Users,
    Star, Target, Lightbulb, Loader2, Brain,
} from 'lucide-react';
import {
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Radar, ResponsiveContainer, Tooltip,
} from 'recharts';

interface CandidateInsightsProps {
    sessionId: string;
}

interface InsightsData {
    candidate_name: string;
    assessment_title: string;
    score_pct: number;
    insights: {
        overall_rating: string;
        confidence: number;
        summary: string;
        strengths: string[];
        weaknesses: string[];
        skill_assessment: Array<{
            skill: string;
            level: string;
            evidence: string;
        }>;
        hiring_recommendation: {
            decision: string;
            reasoning: string;
            suggested_role_fit: string;
            growth_areas: string[];
            interview_follow_ups: string[];
        };
    };
}

const ratingConfig: Record<string, { color: string; bg: string; icon: string; label: string }> = {
    strong_hire: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', icon: '🟢', label: 'Strong Hire' },
    hire: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', icon: '🔵', label: 'Hire' },
    maybe: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '🟡', label: 'Maybe' },
    no_hire: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', icon: '🔴', label: 'No Hire' },
};

const levelColors: Record<string, string> = {
    expert: '#10b981',
    proficient: '#3b82f6',
    intermediate: '#f59e0b',
    beginner: '#ef4444',
};

export default function CandidateInsights({ sessionId }: CandidateInsightsProps) {
    const [data, setData] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchInsights = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/v1/insights/candidate/${sessionId}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!res.ok) throw new Error('Failed to fetch insights');
                const result = await res.json();
                setData(result);
            } catch {
                setError('Failed to load candidate insights');
            } finally {
                setLoading(false);
            }
        };
        fetchInsights();
    }, [sessionId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={20} className="animate-spin" /> Generating AI insights...
            </div>
        );
    }

    if (error || !data?.insights) {
        return (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                <Brain size={32} className="mx-auto mb-2 opacity-50" />
                {error || 'No insights available yet'}
            </div>
        );
    }

    const { insights } = data;
    const rating = ratingConfig[insights.overall_rating] || ratingConfig.maybe;
    const radarData = insights.skill_assessment?.map(s => ({
        skill: s.skill,
        score: s.level === 'expert' ? 95 : s.level === 'proficient' ? 75 : s.level === 'intermediate' ? 50 : 25,
        fullMark: 100,
    })) || [];

    return (
        <div className="space-y-6">
            {/* Hiring Recommendation Card */}
            <div className="rounded-xl p-6" style={{ backgroundColor: rating.bg, border: `1px solid ${rating.color}33` }}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{rating.icon}</span>
                        <div>
                            <h3 className="text-lg font-bold" style={{ color: rating.color }}>{rating.label}</h3>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Confidence: {Math.round(insights.confidence * 100)}%
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(i => (
                            <Star
                                key={i}
                                size={16}
                                fill={i <= Math.round(insights.confidence * 5) ? rating.color : 'transparent'}
                                style={{ color: i <= Math.round(insights.confidence * 5) ? rating.color : 'var(--border)' }}
                            />
                        ))}
                    </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {insights.summary}
                </p>
                {insights.hiring_recommendation?.suggested_role_fit && (
                    <div className="mt-3 flex items-center gap-2">
                        <Target size={14} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Best fit: <strong>{insights.hiring_recommendation.suggested_role_fit}</strong>
                        </span>
                    </div>
                )}
            </div>

            {/* Skill Radar + Strengths/Weaknesses */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Skill Radar */}
                {radarData.length > 0 && (
                    <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                        <h4 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>
                            Skill Assessment
                        </h4>
                        <div style={{ width: '100%', height: 250 }}>
                            <ResponsiveContainer>
                                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                                    <PolarGrid stroke="var(--border)" />
                                    <PolarAngleAxis dataKey="skill" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                                    <Radar dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} strokeWidth={2} />
                                    <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-3 space-y-2">
                            {insights.skill_assessment?.map(s => (
                                <div key={s.skill} className="flex items-center justify-between text-xs">
                                    <span style={{ color: 'var(--text-secondary)' }}>{s.skill}</span>
                                    <span className="px-2 py-0.5 rounded-full font-semibold capitalize" style={{ color: levelColors[s.level] || 'var(--text-muted)', backgroundColor: `${levelColors[s.level] || '#666'}15` }}>
                                        {s.level}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Strengths & Weaknesses */}
                <div className="space-y-4">
                    {insights.strengths?.length > 0 && (
                        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp size={16} style={{ color: 'var(--success)' }} />
                                <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--success)' }}>Strengths</h4>
                            </div>
                            <ul className="space-y-2">
                                {insights.strengths.map((s, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                        <span className="text-green-500 mt-0.5">✓</span> {s}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {insights.weaknesses?.length > 0 && (
                        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingDown size={16} style={{ color: 'var(--danger)' }} />
                                <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--danger)' }}>Areas for Improvement</h4>
                            </div>
                            <ul className="space-y-2">
                                {insights.weaknesses.map((w, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                        <span className="text-red-500 mt-0.5">•</span> {w}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Follow-up Questions */}
            {insights.hiring_recommendation?.interview_follow_ups?.length > 0 && (
                <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <Lightbulb size={16} style={{ color: 'var(--warning)' }} />
                        <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                            Suggested Follow-up Questions
                        </h4>
                    </div>
                    <ol className="space-y-2 list-decimal list-inside">
                        {insights.hiring_recommendation.interview_follow_ups.map((q, i) => (
                            <li key={i} className="text-sm" style={{ color: 'var(--text-secondary)' }}>{q}</li>
                        ))}
                    </ol>
                </div>
            )}

            {/* Growth Areas */}
            {insights.hiring_recommendation?.growth_areas?.length > 0 && (
                <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                    <div className="flex items-center gap-2 mb-3">
                        <Users size={16} style={{ color: 'var(--accent)' }} />
                        <h4 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                            Growth & Development Areas
                        </h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {insights.hiring_recommendation.growth_areas.map((area, i) => (
                            <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                                {area}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
