import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Play, Pause, SkipBack, SkipForward, AlertTriangle,
    Activity, Clock, Clipboard, Loader2,
} from 'lucide-react';
import Editor from '@monaco-editor/react';

interface PlaybackFrame {
    index: number;
    timestamp: string;
    elapsed_seconds: number;
    code: string;
    diff_summary: string;
    chars_added: number;
    chars_deleted: number;
    event_type: string;
    typing_speed_cpm: number;
}

interface BehaviorMetrics {
    total_snapshots: number;
    total_time_seconds: number;
    active_time_seconds: number;
    idle_time_seconds: number;
    avg_typing_speed_cpm: number;
    peak_typing_speed_cpm: number;
    paste_events: number;
    paste_char_ratio: number;
    large_paste_events: number;
    total_chars_typed: number;
    total_chars_pasted: number;
    anomaly_score: number;
    anomalies: Array<{ type: string; elapsed_seconds: number; detail: string }>;
    idle_periods: Array<{ start_elapsed: number; end_elapsed: number; duration_seconds: number }>;
}

interface CodePlaybackViewerProps {
    sessionId: string;
    questionId: string;
    language?: string;
}

export default function CodePlaybackViewer({ sessionId, questionId, language = 'python' }: CodePlaybackViewerProps) {
    const [frames, setFrames] = useState<PlaybackFrame[]>([]);
    const [metrics, setMetrics] = useState<BehaviorMetrics | null>(null);
    const [currentFrame, setCurrentFrame] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers: Record<string, string> = {};
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const [playbackRes, analyticsRes] = await Promise.all([
                    fetch(`/api/v1/code-playback/${sessionId}/${questionId}`, { headers }),
                    fetch(`/api/v1/code-playback/${sessionId}/${questionId}/analytics`, { headers }),
                ]);

                if (playbackRes.ok) {
                    const data = await playbackRes.json();
                    setFrames(data.frames || []);
                }
                if (analyticsRes.ok) {
                    const data = await analyticsRes.json();
                    setMetrics(data.metrics || null);
                }
            } catch {
                setError('Failed to load playback data');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [sessionId, questionId]);

    const play = useCallback(() => {
        if (currentFrame >= frames.length - 1) setCurrentFrame(0);
        setIsPlaying(true);
    }, [currentFrame, frames.length]);

    const pause = useCallback(() => setIsPlaying(false), []);

    useEffect(() => {
        if (!isPlaying || frames.length === 0) return;
        intervalRef.current = setInterval(() => {
            setCurrentFrame((prev) => {
                if (prev >= frames.length - 1) {
                    setIsPlaying(false);
                    return prev;
                }
                return prev + 1;
            });
        }, 800 / playbackSpeed);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isPlaying, playbackSpeed, frames.length]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={20} className="animate-spin" /> Loading playback...
            </div>
        );
    }

    if (error || frames.length === 0) {
        return (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                {error || 'No code playback data available'}
            </div>
        );
    }

    const frame = frames[currentFrame];
    const totalSeconds = frames[frames.length - 1]?.elapsed_seconds || 0;
    const progressPct = totalSeconds > 0 ? (frame.elapsed_seconds / totalSeconds) * 100 : 0;

    const anomalyScore = metrics?.anomaly_score ?? 0;
    const anomalyColor = anomalyScore >= 60 ? 'var(--danger)' : anomalyScore >= 30 ? 'var(--warning)' : 'var(--success)';

    return (
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                    <Activity size={18} style={{ color: 'var(--accent)' }} />
                    <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Code Playback</h3>
                </div>
                {metrics && (
                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span className="flex items-center gap-1"><Clock size={12} /> {Math.round(metrics.total_time_seconds / 60)}m</span>
                        <span className="flex items-center gap-1"><Clipboard size={12} /> {metrics.paste_events} pastes</span>
                        <span className="px-2 py-0.5 rounded-full font-semibold" style={{ color: anomalyColor, backgroundColor: anomalyScore >= 60 ? 'rgba(239,68,68,0.12)' : anomalyScore >= 30 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)' }}>
                            Risk: {anomalyScore}/100
                        </span>
                    </div>
                )}
            </div>

            {/* Monaco Editor */}
            <div style={{ height: 350 }}>
                <Editor
                    height="100%"
                    language={language}
                    value={frame.code}
                    theme="vs-dark"
                    options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, lineNumbers: 'on', wordWrap: 'on' }}
                />
            </div>

            {/* Timeline */}
            <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                {/* Progress bar with anomaly markers */}
                <div className="relative h-2 rounded-full mb-3 cursor-pointer" style={{ backgroundColor: 'var(--bg-secondary)' }}
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = (e.clientX - rect.left) / rect.width;
                        setCurrentFrame(Math.round(pct * (frames.length - 1)));
                    }}
                >
                    <div className="absolute top-0 left-0 h-full rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: 'var(--accent)' }} />
                    {/* Anomaly markers */}
                    {metrics?.anomalies.map((a, i) => (
                        <div key={i} className="absolute top-0 w-1 h-full" title={a.detail}
                            style={{ left: `${(a.elapsed_seconds / totalSeconds) * 100}%`, backgroundColor: a.type === 'large_paste' ? 'var(--danger)' : 'var(--warning)' }}
                        />
                    ))}
                    {/* Idle period markers */}
                    {metrics?.idle_periods.map((ip, i) => (
                        <div key={`idle-${i}`} className="absolute top-0 h-full opacity-30" title={`Idle: ${ip.duration_seconds}s`}
                            style={{ left: `${(ip.start_elapsed / totalSeconds) * 100}%`, width: `${((ip.end_elapsed - ip.start_elapsed) / totalSeconds) * 100}%`, backgroundColor: 'var(--text-muted)' }}
                        />
                    ))}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}>
                            <SkipBack size={14} />
                        </button>
                        <button onClick={isPlaying ? pause : play} className="p-2 rounded-lg" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button onClick={() => setCurrentFrame(Math.min(frames.length - 1, currentFrame + 1))} className="p-1.5 rounded-lg hover:opacity-80" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}>
                            <SkipForward size={14} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span>{Math.round(frame.elapsed_seconds)}s / {Math.round(totalSeconds)}s</span>
                        <span className="font-mono">{currentFrame + 1}/{frames.length}</span>
                        {frame.event_type === 'paste' && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: 'var(--danger)', backgroundColor: 'rgba(239,68,68,0.12)' }}>
                                <AlertTriangle size={10} /> PASTE
                            </span>
                        )}
                        <span>{Math.round(frame.typing_speed_cpm)} CPM</span>
                    </div>

                    <div className="flex items-center gap-1">
                        {[0.5, 1, 2, 4].map((speed) => (
                            <button key={speed} onClick={() => setPlaybackSpeed(speed)}
                                className="px-2 py-1 rounded text-xs font-medium transition-colors"
                                style={{
                                    backgroundColor: playbackSpeed === speed ? 'var(--accent)' : 'var(--bg-secondary)',
                                    color: playbackSpeed === speed ? '#fff' : 'var(--text-secondary)',
                                }}
                            >
                                {speed}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Typing Speed Graph */}
            {frames.length > 2 && (
                <div className="px-5 pb-4">
                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Typing Speed Over Time</p>
                    <div className="flex items-end h-12 gap-px">
                        {frames.map((f, i) => {
                            const maxCpm = Math.max(...frames.map(fr => fr.typing_speed_cpm), 1);
                            const height = (f.typing_speed_cpm / maxCpm) * 100;
                            const isPaste = f.event_type === 'paste';
                            const isCurrent = i === currentFrame;
                            return (
                                <div
                                    key={i}
                                    className="flex-1 rounded-t cursor-pointer transition-all"
                                    style={{
                                        height: `${Math.max(2, height)}%`,
                                        backgroundColor: isPaste ? 'var(--danger)' : isCurrent ? 'var(--accent)' : 'var(--border)',
                                        opacity: isCurrent ? 1 : 0.6,
                                        minWidth: 1,
                                    }}
                                    onClick={() => setCurrentFrame(i)}
                                    title={`${Math.round(f.typing_speed_cpm)} CPM at ${Math.round(f.elapsed_seconds)}s`}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
