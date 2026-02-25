import { useState, useEffect, useCallback, useRef } from 'react';
import WebcamMonitor from './WebcamMonitor';
import AudioMonitor from './AudioMonitor';
import ScreenRecorder from './ScreenRecorder';

interface ProctoringConfig {
    enabled: boolean;
    max_violations: number;
    require_fullscreen?: boolean;
    block_copy_paste?: boolean;
    detect_tab_switch?: boolean;
    webcam_monitoring?: boolean;
    screen_recording?: boolean;
    audio_monitoring?: boolean;
    id_verification?: boolean;
}

interface ProctoringGuardProps {
    config: ProctoringConfig;
    candidateToken: string;
    onTerminated: () => void;
    children: React.ReactNode;
}

const VIOLATION_MESSAGES: Record<string, string> = {
    tab_switch: '⚠️ Tab switching detected! Stay on the test page.',
    fullscreen_exit: '⚠️ Fullscreen mode is required. Returning to fullscreen...',
    copy_attempt: '⚠️ Copy is not allowed during this assessment.',
    paste_attempt: '⚠️ Paste is not allowed during this assessment.',
    right_click: '⚠️ Right-click is disabled during this assessment.',
    idle_timeout: '⚠️ Extended inactivity detected.',
    window_blur: '⚠️ Focus on the assessment window.',
};

export default function ProctoringGuard({ config, candidateToken, onTerminated, children }: ProctoringGuardProps) {
    const [violations, setViolations] = useState(0);
    const [maxViolations, setMaxViolations] = useState(config.max_violations || 5);
    const [warningMessage, setWarningMessage] = useState('');
    const [showWarning, setShowWarning] = useState(false);
    const [isTerminated, setIsTerminated] = useState(false);
    const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const reportViolation = useCallback(async (type: string, details: string) => {
        setWarningMessage(VIOLATION_MESSAGES[type] || `⚠️ Proctoring violation: ${type}`);
        setShowWarning(true);

        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = setTimeout(() => setShowWarning(false), 5000);

        try {
            const res = await fetch('/api/v1/test/proctoring/violation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${candidateToken}`,
                },
                body: JSON.stringify({
                    violation_type: type,
                    details,
                    timestamp: new Date().toISOString(),
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setViolations(data.violations);
                setMaxViolations(data.max_violations);
                if (data.is_terminated) {
                    setIsTerminated(true);
                    onTerminated();
                }
            }
        } catch {
            // Silently fail — don't block the test
        }

        // Also record as a structured proctoring event
        try {
            await fetch('/api/v1/proctoring/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${candidateToken}`,
                },
                body: JSON.stringify({
                    event_type: type,
                    severity: ['fullscreen_exit', 'dev_tools'].includes(type) ? 'critical' : 'warning',
                    details,
                    client_timestamp: new Date().toISOString(),
                }),
            });
        } catch {
            // Best effort
        }
    }, [candidateToken, onTerminated]);

    // Visibility change detection (tab switch)
    useEffect(() => {
        if (!config.detect_tab_switch) return;
        const handler = () => {
            if (document.hidden) {
                reportViolation('tab_switch', 'Candidate switched away from the test tab');
            }
        };
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
    }, [config.detect_tab_switch, reportViolation]);

    // Window blur detection
    useEffect(() => {
        if (!config.detect_tab_switch) return;
        const handler = () => reportViolation('window_blur', 'Window lost focus');
        window.addEventListener('blur', handler);
        return () => window.removeEventListener('blur', handler);
    }, [config.detect_tab_switch, reportViolation]);

    // Fullscreen enforcement
    useEffect(() => {
        if (!config.require_fullscreen) return;

        const enterFullscreen = () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen?.().catch(() => { });
            }
        };

        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && config.require_fullscreen) {
                reportViolation('fullscreen_exit', 'Candidate exited fullscreen mode');
                // Re-enter fullscreen after a brief delay
                setTimeout(enterFullscreen, 1000);
            }
        };

        enterFullscreen();
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [config.require_fullscreen, reportViolation]);

    // Copy/paste blocking
    useEffect(() => {
        if (!config.block_copy_paste) return;

        const handleCopy = (e: ClipboardEvent) => {
            e.preventDefault();
            reportViolation('copy_attempt', 'Candidate attempted to copy content');
        };

        const handlePaste = (e: ClipboardEvent) => {
            e.preventDefault();
            reportViolation('paste_attempt', 'Candidate attempted to paste content');
        };

        const handleCut = (e: ClipboardEvent) => {
            e.preventDefault();
            reportViolation('copy_attempt', 'Candidate attempted to cut content');
        };

        document.addEventListener('copy', handleCopy);
        document.addEventListener('paste', handlePaste);
        document.addEventListener('cut', handleCut);
        return () => {
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('paste', handlePaste);
            document.removeEventListener('cut', handleCut);
        };
    }, [config.block_copy_paste, reportViolation]);

    // Right-click blocking
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            reportViolation('right_click', 'Candidate attempted right-click');
        };
        document.addEventListener('contextmenu', handleContextMenu);
        return () => document.removeEventListener('contextmenu', handleContextMenu);
    }, [reportViolation]);

    // Keyboard shortcut blocking
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Block common copy/paste shortcuts
            if (config.block_copy_paste && (e.ctrlKey || e.metaKey)) {
                if (['c', 'v', 'x'].includes(e.key.toLowerCase())) {
                    e.preventDefault();
                    reportViolation('copy_attempt', `Keyboard shortcut Ctrl+${e.key.toUpperCase()} blocked`);
                }
            }
            // Block dev tools
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))) {
                e.preventDefault();
                reportViolation('dev_tools', 'Attempted to open developer tools');
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [config.block_copy_paste, reportViolation]);

    if (isTerminated) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
                <div className="text-center p-8 rounded-2xl max-w-md" style={{ backgroundColor: 'var(--card-bg)' }}>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(239,68,68,0.15)' }}>
                        <span className="text-3xl">🚫</span>
                    </div>
                    <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Test Terminated</h2>
                    <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                        Your test has been terminated due to excessive proctoring violations ({violations}/{maxViolations}).
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Please contact the assessment administrator if you believe this is an error.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            {/* Warning banner */}
            {showWarning && (
                <div
                    className="fixed top-0 left-0 right-0 z-50 px-4 py-3 text-center text-sm font-medium animate-pulse"
                    style={{ backgroundColor: 'rgba(239,68,68,0.95)', color: '#fff' }}
                >
                    {warningMessage}
                    <span className="ml-4 opacity-75">({violations}/{maxViolations} violations)</span>
                </div>
            )}

            {/* Violation counter badge */}
            {violations > 0 && (
                <div
                    className="fixed top-4 right-4 z-40 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2"
                    style={{
                        backgroundColor: violations >= maxViolations * 0.7 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: violations >= maxViolations * 0.7 ? 'var(--danger)' : 'var(--warning)',
                        border: `1px solid ${violations >= maxViolations * 0.7 ? 'var(--danger)' : 'var(--warning)'}`,
                    }}
                >
                    ⚠️ {violations}/{maxViolations}
                </div>
            )}

            {/* Webcam Monitor */}
            <WebcamMonitor
                candidateToken={candidateToken}
                enabled={!!config.webcam_monitoring}
                intervalSeconds={30}
            />

            {/* Audio Monitor */}
            <AudioMonitor
                candidateToken={candidateToken}
                enabled={!!config.audio_monitoring}
            />

            {/* Screen Recorder */}
            <ScreenRecorder
                candidateToken={candidateToken}
                enabled={!!config.screen_recording}
            />

            {children}
        </div>
    );
}
