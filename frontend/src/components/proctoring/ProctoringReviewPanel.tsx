import { useState, useEffect, useCallback } from 'react';
import {
    Shield, Camera, Mic, Monitor, Fingerprint, AlertTriangle,
    Clock, Eye, ChevronDown, ChevronRight, Loader2, Play,
} from 'lucide-react';

interface ProctoringReviewPanelProps {
    sessionId: string;
    authToken: string;
}

interface ProctoringReport {
    risk_level: string;
    risk_score: number;
    total_violations: number;
    total_events: number;
    snapshot_count: number;
    candidate_name: string;
    candidate_email: string;
    ip_address: string | null;
    event_summary: { type: string; severity: string; count: number }[];
    identity_verification: {
        status: string;
        confidence: number | null;
        method: string | null;
    };
    plagiarism_analysis: {
        response_id: string;
        plagiarism_score: number;
        llm_probability: number;
        is_flagged: boolean;
        findings: Record<string, unknown>;
    }[];
}

interface TimelineEvent {
    id: string;
    type: string;
    severity: string;
    details: string | null;
    recorded_at: string | null;
    ip_address: string | null;
}

interface Snapshot {
    id: string;
    captured_at: string | null;
    face_count: number | null;
    image_data: string;
}

export default function ProctoringReviewPanel({ sessionId, authToken }: ProctoringReviewPanelProps) {
    const [report, setReport] = useState<ProctoringReport | null>(null);
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'snapshots' | 'integrity'>('overview');
    const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);
    const [analyzingIntegrity, setAnalyzingIntegrity] = useState(false);
    const [integrityResults, setIntegrityResults] = useState<Record<string, unknown>[] | null>(null);

    const headers = { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' };

    const fetchReport = useCallback(async () => {
        setLoading(true);
        try {
            const [reportRes, timelineRes, snapshotsRes] = await Promise.all([
                fetch(`/api/v1/proctoring/${sessionId}/report`, { headers }),
                fetch(`/api/v1/proctoring/${sessionId}/timeline`, { headers }),
                fetch(`/api/v1/proctoring/${sessionId}/snapshots`, { headers }),
            ]);
            if (reportRes.ok) setReport(await reportRes.json());
            if (timelineRes.ok) {
                const data = await timelineRes.json();
                setTimeline(data.events || []);
            }
            if (snapshotsRes.ok) {
                const data = await snapshotsRes.json();
                setSnapshots(data.snapshots || []);
            }
        } catch {
            // Handle error silently
        } finally {
            setLoading(false);
        }
    }, [sessionId, authToken]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const runIntegrityAnalysis = async () => {
        setAnalyzingIntegrity(true);
        try {
            const res = await fetch(`/api/v1/proctoring/${sessionId}/analyze-integrity`, {
                method: 'POST',
                headers,
            });
            if (res.ok) {
                const data = await res.json();
                setIntegrityResults(data.reports || []);
                fetchReport(); // Refresh the report
            }
        } catch {
            // Handle error
        } finally {
            setAnalyzingIntegrity(false);
        }
    };

    const riskColors: Record<string, string> = {
        low: '#10b981',
        medium: '#f59e0b',
        high: '#ef4444',
    };

    const severityColors: Record<string, string> = {
        info: '#6b7280',
        warning: '#f59e0b',
        critical: '#ef4444',
    };

    const eventIcons: Record<string, typeof Shield> = {
        tab_switch: Eye,
        window_blur: Eye,
        fullscreen_exit: Monitor,
        copy_attempt: AlertTriangle,
        paste_attempt: AlertTriangle,
        webcam_face_missing: Camera,
        webcam_multi_face: Camera,
        audio_anomaly: Mic,
        screen_share_stopped: Monitor,
        ip_change: Shield,
        dev_tools: AlertTriangle,
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
        );
    }

    if (!report) {
        return (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                <Shield size={32} className="mx-auto mb-2" style={{ opacity: 0.4 }} />
                <p className="text-sm">No proctoring data available for this session</p>
            </div>
        );
    }

    return (
        <div>
            {/* Tab navigation */}
            <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                {[
                    { key: 'overview', label: 'Overview', icon: Shield },
                    { key: 'timeline', label: `Timeline (${timeline.length})`, icon: Clock },
                    { key: 'snapshots', label: `Webcam (${snapshots.length})`, icon: Camera },
                    { key: 'integrity', label: 'Integrity', icon: Fingerprint },
                ].map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setActiveTab(key as typeof activeTab)}
                        className="flex-1 py-2 px-3 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        style={{
                            backgroundColor: activeTab === key ? 'var(--card-bg)' : 'transparent',
                            color: activeTab === key ? 'var(--text-primary)' : 'var(--text-muted)',
                            boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        }}
                    >
                        <Icon size={14} />
                        {label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-4">
                    {/* Risk Score Card */}
                    <div
                        className="p-4 rounded-xl"
                        style={{
                            backgroundColor: `${riskColors[report.risk_level]}10`,
                            border: `1px solid ${riskColors[report.risk_level]}40`,
                        }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Shield size={20} color={riskColors[report.risk_level]} />
                                <span className="text-sm font-bold" style={{ color: riskColors[report.risk_level] }}>
                                    {report.risk_level.toUpperCase()} RISK
                                </span>
                            </div>
                            <span
                                className="text-2xl font-bold"
                                style={{ color: riskColors[report.risk_level] }}
                            >
                                {report.risk_score}
                            </span>
                        </div>
                        <div className="h-2 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.1)' }}>
                            <div
                                className="h-2 rounded-full transition-all"
                                style={{
                                    width: `${Math.min(100, report.risk_score)}%`,
                                    backgroundColor: riskColors[report.risk_level],
                                }}
                            />
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Violations', value: report.total_violations, icon: AlertTriangle, color: '#ef4444' },
                            { label: 'Events', value: report.total_events, icon: Clock, color: '#6366f1' },
                            { label: 'Snapshots', value: report.snapshot_count, icon: Camera, color: '#10b981' },
                            { label: 'IP', value: report.ip_address || 'N/A', icon: Monitor, color: '#8b5cf6' },
                        ].map(({ label, value, icon: Icon, color }) => (
                            <div
                                key={label}
                                className="p-3 rounded-lg"
                                style={{ backgroundColor: 'var(--bg-secondary)' }}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon size={14} color={color} />
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                                </div>
                                <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                    {value}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Identity Verification */}
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <div className="flex items-center gap-2 mb-1">
                            <Fingerprint size={14} color="#6366f1" />
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Identity Verification</span>
                        </div>
                        <span
                            className="text-sm font-medium"
                            style={{
                                color: report.identity_verification.status === 'verified' ? '#10b981'
                                    : report.identity_verification.status === 'not_verified' ? '#f59e0b'
                                        : '#6b7280',
                            }}
                        >
                            {report.identity_verification.status === 'verified' ? '✅ Verified' :
                                report.identity_verification.status === 'not_verified' ? '⏳ Pending Review' :
                                    '❌ Not Submitted'}
                        </span>
                    </div>

                    {/* Event Breakdown */}
                    {report.event_summary.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                                Event Breakdown
                            </h4>
                            <div className="space-y-1.5">
                                {report.event_summary.map((ev, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between px-3 py-2 rounded-lg"
                                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: severityColors[ev.severity] || '#6b7280' }}
                                            />
                                            <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                                {ev.type.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                            {ev.count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
                <div className="space-y-1">
                    {timeline.length === 0 ? (
                        <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                            No events recorded
                        </p>
                    ) : (
                        timeline.map((ev) => {
                            const Icon = eventIcons[ev.type] || AlertTriangle;
                            return (
                                <div
                                    key={ev.id}
                                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
                                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                                >
                                    <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center mt-0.5 shrink-0"
                                        style={{ backgroundColor: `${severityColors[ev.severity]}20` }}
                                    >
                                        <Icon size={14} color={severityColors[ev.severity]} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                                {ev.type.replace(/_/g, ' ')}
                                            </span>
                                            <span
                                                className="text-xs px-1.5 py-0.5 rounded"
                                                style={{
                                                    backgroundColor: `${severityColors[ev.severity]}20`,
                                                    color: severityColors[ev.severity],
                                                }}
                                            >
                                                {ev.severity}
                                            </span>
                                        </div>
                                        {ev.details && (
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {ev.details}
                                            </p>
                                        )}
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                                            {ev.recorded_at ? new Date(ev.recorded_at).toLocaleTimeString() : ''}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Snapshots Tab */}
            {activeTab === 'snapshots' && (
                <div>
                    {snapshots.length === 0 ? (
                        <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                            No webcam snapshots captured
                        </p>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            {snapshots.map((snap) => (
                                <div
                                    key={snap.id}
                                    className="cursor-pointer rounded-lg overflow-hidden"
                                    style={{
                                        border: snap.face_count !== 1 ? '2px solid #ef4444' : '1px solid var(--border)',
                                    }}
                                    onClick={() => setExpandedSnapshot(expandedSnapshot === snap.id ? null : snap.id)}
                                >
                                    <div style={{ aspectRatio: '4/3', backgroundColor: '#111' }}>
                                        <img
                                            src={`data:image/jpeg;base64,${snap.image_data}`}
                                            alt="Webcam snapshot"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div className="px-2 py-1" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {snap.captured_at ? new Date(snap.captured_at).toLocaleTimeString() : ''}
                                        </span>
                                        {snap.face_count !== null && snap.face_count !== 1 && (
                                            <span className="text-xs ml-1" style={{ color: '#ef4444' }}>
                                                👤 {snap.face_count}
                                            </span>
                                        )}
                                    </div>
                                    {expandedSnapshot === snap.id && (
                                        <div className="col-span-3 p-2" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                            <img
                                                src={`data:image/jpeg;base64,${snap.image_data}`}
                                                alt="Expanded"
                                                className="rounded-lg w-full"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Integrity Tab */}
            {activeTab === 'integrity' && (
                <div className="space-y-4">
                    {/* Existing analysis */}
                    {report.plagiarism_analysis.length > 0 ? (
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                                Analysis Results
                            </h4>
                            {report.plagiarism_analysis.map((p, i) => (
                                <div
                                    key={i}
                                    className="p-3 rounded-lg"
                                    style={{
                                        backgroundColor: p.is_flagged ? 'rgba(239,68,68,0.08)' : 'var(--bg-secondary)',
                                        border: p.is_flagged ? '1px solid rgba(239,68,68,0.3)' : 'none',
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                            Response {i + 1}
                                        </span>
                                        {p.is_flagged && (
                                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>
                                                ⚠️ Flagged
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-4">
                                        <div>
                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Plagiarism</span>
                                            <p
                                                className="text-lg font-bold"
                                                style={{ color: p.plagiarism_score >= 60 ? '#ef4444' : p.plagiarism_score >= 30 ? '#f59e0b' : '#10b981' }}
                                            >
                                                {p.plagiarism_score.toFixed(0)}%
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>AI-Generated</span>
                                            <p
                                                className="text-lg font-bold"
                                                style={{ color: p.llm_probability >= 70 ? '#ef4444' : p.llm_probability >= 40 ? '#f59e0b' : '#10b981' }}
                                            >
                                                {p.llm_probability.toFixed(0)}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : integrityResults ? (
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                                Fresh Analysis Results
                            </h4>
                            {integrityResults.map((r, i) => (
                                <div key={i} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                        Response {i + 1}: Plagiarism {(r.plagiarism_score as number || 0).toFixed(0)}% | AI {(r.llm_probability as number || 0).toFixed(0)}%
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-6">
                            <Fingerprint size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                                Run AI-powered integrity analysis to detect plagiarism and LLM-generated answers.
                            </p>
                        </div>
                    )}

                    <button
                        onClick={runIntegrityAnalysis}
                        disabled={analyzingIntegrity}
                        className="w-full py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                        style={{ backgroundColor: '#6366f1' }}
                    >
                        {analyzingIntegrity ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <Play size={16} />
                                {report.plagiarism_analysis.length > 0 ? 'Re-run Integrity Analysis' : 'Run Integrity Analysis'}
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
