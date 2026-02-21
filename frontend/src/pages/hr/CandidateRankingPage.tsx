import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Trophy, TrendingUp, TrendingDown, Clock,
    Shield, Download, Loader2, Search,
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import toast from 'react-hot-toast';

interface RankedCandidate {
    rank: number;
    session_id: string;
    candidate_name: string;
    candidate_email: string;
    status: string;
    score_pct: number | null;
    total_score: number | null;
    total_max_score: number | null;
    is_passed: boolean | null;
    time_taken_seconds: number | null;
    proctoring_violations: number | null;
    skill_scores: Record<string, number> | null;
    started_at: string | null;
    completed_at: string | null;
}

export default function CandidateRankingPage() {
    const { assessmentId } = useParams<{ assessmentId: string }>();
    const navigate = useNavigate();
    const [rankings, setRankings] = useState<RankedCandidate[]>([]);
    const [assessmentTitle, setAssessmentTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('');

    useEffect(() => {
        if (!assessmentId) return;
        const fetchRankings = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/v1/insights/ranking/${assessmentId}`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (res.ok) {
                    const data = await res.json();
                    setRankings(data.rankings || []);
                    setAssessmentTitle(data.assessment_title || '');
                }
            } catch {
                toast.error('Failed to load rankings');
            } finally {
                setLoading(false);
            }
        };
        fetchRankings();
    }, [assessmentId]);

    const filtered = rankings.filter(r => {
        if (filterStatus && r.status !== filterStatus) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return r.candidate_name.toLowerCase().includes(q) || r.candidate_email.toLowerCase().includes(q);
        }
        return true;
    });

    const barData = filtered.slice(0, 20).map(r => ({
        name: r.candidate_name.split(' ')[0],
        score: r.score_pct || 0,
        passed: r.is_passed,
    }));

    const avgScore = filtered.reduce((sum, r) => sum + (r.score_pct || 0), 0) / (filtered.length || 1);
    const passRate = filtered.filter(r => r.is_passed).length / (filtered.length || 1) * 100;

    const handleExportPdf = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/v1/reports/assessment/${assessmentId}/pdf`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `assessment_report.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('PDF downloaded');
        } catch {
            toast.error('Failed to download PDF');
        }
    };

    const handleExportExcel = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/v1/reports/assessment/${assessmentId}/excel`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `assessment_export.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('Excel downloaded');
        } catch {
            toast.error('Failed to download Excel');
        }
    };

    const formatTime = (seconds: number | null) => {
        if (!seconds) return '-';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading candidate rankings...</p>
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
                <button onClick={() => navigate(-1)} className="p-2 rounded-lg mt-1" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}>
                    <ArrowLeft size={18} />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Candidate Rankings</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{assessmentTitle}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleExportPdf} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                        <Download size={14} /> PDF
                    </button>
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                        <Download size={14} /> Excel
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total Candidates', value: rankings.length, icon: <Trophy size={20} style={{ color: '#f59e0b' }} /> },
                    { label: 'Average Score', value: `${avgScore.toFixed(1)}%`, icon: <TrendingUp size={20} style={{ color: '#3b82f6' }} /> },
                    { label: 'Pass Rate', value: `${passRate.toFixed(1)}%`, icon: <TrendingDown size={20} style={{ color: '#10b981' }} /> },
                    { label: 'Completed', value: rankings.filter(r => r.status === 'completed').length, icon: <Shield size={20} style={{ color: '#8b5cf6' }} /> },
                ].map((stat, i) => (
                    <div key={i} className="rounded-xl p-4 flex items-center justify-between" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                        <div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                            <p className="text-xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                        </div>
                        <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>{stat.icon}</div>
                    </div>
                ))}
            </div>

            {/* Score Distribution Chart */}
            {barData.length > 0 && (
                <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                    <h3 className="text-sm font-semibold uppercase mb-4" style={{ color: 'var(--text-muted)' }}>Score Distribution</h3>
                    <div style={{ width: '100%', height: 200 }}>
                        <ResponsiveContainer>
                            <BarChart data={barData}>
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                                    {barData.map((entry, i) => (
                                        <Cell key={i} fill={entry.passed ? '#10b981' : entry.score >= 50 ? '#f59e0b' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input type="text" placeholder="Search candidates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                </div>
                {['', 'completed', 'terminated', 'timed_out'].map(status => (
                    <button key={status} onClick={() => setFilterStatus(status)}
                        className="px-3 py-2 rounded-lg text-xs font-medium"
                        style={{
                            backgroundColor: filterStatus === status ? 'var(--accent)' : 'var(--bg-secondary)',
                            color: filterStatus === status ? '#fff' : 'var(--text-secondary)',
                        }}
                    >
                        {status || 'All'}
                    </button>
                ))}
            </div>

            {/* Rankings Table */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                            {['Rank', 'Candidate', 'Score', 'Status', 'Time', 'Violations', 'Result'].map(h => (
                                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r) => (
                            <tr
                                key={r.session_id}
                                className="cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ borderBottom: '1px solid var(--border)' }}
                                onClick={() => navigate(`/hr/evaluation/${r.session_id}`)}
                            >
                                <td className="px-4 py-3">
                                    <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                                        style={{
                                            backgroundColor: r.rank <= 3 ? 'rgba(245,158,11,0.15)' : 'var(--bg-secondary)',
                                            color: r.rank <= 3 ? '#f59e0b' : 'var(--text-secondary)',
                                        }}
                                    >
                                        {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{r.candidate_name}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.candidate_email}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="font-semibold" style={{ color: (r.score_pct || 0) >= 70 ? 'var(--success)' : (r.score_pct || 0) >= 40 ? 'var(--warning)' : 'var(--danger)' }}>
                                        {r.score_pct != null ? `${r.score_pct.toFixed(1)}%` : '-'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                                        style={{
                                            backgroundColor: r.status === 'completed' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                            color: r.status === 'completed' ? 'var(--success)' : 'var(--danger)',
                                        }}
                                    >
                                        {r.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                                    <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(r.time_taken_seconds)}</span>
                                </td>
                                <td className="px-4 py-3" style={{ color: (r.proctoring_violations || 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                                    {r.proctoring_violations || 0}
                                </td>
                                <td className="px-4 py-3">
                                    {r.is_passed != null ? (
                                        <span className="text-xs font-bold" style={{ color: r.is_passed ? 'var(--success)' : 'var(--danger)' }}>
                                            {r.is_passed ? '✓ PASS' : '✗ FAIL'}
                                        </span>
                                    ) : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                        No candidates found
                    </div>
                )}
            </div>
        </div>
    );
}
