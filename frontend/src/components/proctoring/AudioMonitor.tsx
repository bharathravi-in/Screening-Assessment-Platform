import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface AudioMonitorProps {
    candidateToken: string;
    enabled: boolean;
    noiseThreshold?: number;
    speechThreshold?: number;
}

/**
 * Audio environment monitor that detects ambient noise and speech-like patterns
 * using the Web Audio API AnalyserNode.
 */
export default function AudioMonitor({
    candidateToken,
    enabled,
    noiseThreshold = 60,
    speechThreshold = 75,
}: AudioMonitorProps) {
    const streamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number>(0);
    const alertCooldownRef = useRef<number>(0);
    const [noiseLevel, setNoiseLevel] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [alertCount, setAlertCount] = useState(0);

    useEffect(() => {
        if (!enabled) return;

        let audioCtx: AudioContext | null = null;

        const startAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: false },
                });
                streamRef.current = stream;

                audioCtx = new AudioContext();
                const source = audioCtx.createMediaStreamSource(stream);
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.8;
                source.connect(analyser);
                analyserRef.current = analyser;
                setIsActive(true);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);

                const monitor = () => {
                    analyser.getByteFrequencyData(dataArray);
                    const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    const normalized = Math.min(100, (avg / 128) * 100);
                    setNoiseLevel(normalized);

                    const now = Date.now();
                    if (now > alertCooldownRef.current) {
                        // Speech-like detection: check energy in speech frequencies (300Hz - 3400Hz)
                        const speechBins = dataArray.slice(2, 22); // Approximate speech range
                        const speechEnergy =
                            speechBins.reduce((a, b) => a + b, 0) / speechBins.length;
                        const speechNorm = Math.min(100, (speechEnergy / 128) * 100);

                        if (speechNorm >= speechThreshold) {
                            sendAlert('speech_detected', speechNorm, 'Speech-like audio detected');
                            alertCooldownRef.current = now + 15000; // 15s cooldown
                        } else if (normalized >= noiseThreshold) {
                            sendAlert('noise_spike', normalized, `Ambient noise level: ${normalized.toFixed(0)}`);
                            alertCooldownRef.current = now + 10000; // 10s cooldown
                        }
                    }

                    animFrameRef.current = requestAnimationFrame(monitor);
                };

                monitor();
            } catch {
                setIsActive(false);
            }
        };

        const sendAlert = async (type: string, level: number, details: string) => {
            setAlertCount((c) => c + 1);
            try {
                await fetch('/api/v1/proctoring/audio-alert', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${candidateToken}`,
                    },
                    body: JSON.stringify({
                        noise_level: level,
                        duration_seconds: 1,
                        alert_type: type,
                        details,
                    }),
                });
            } catch {
                // Best effort
            }
        };

        startAudio();

        return () => {
            cancelAnimationFrame(animFrameRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
            if (audioCtx) audioCtx.close();
        };
    }, [enabled, noiseThreshold, speechThreshold, candidateToken]);

    if (!enabled) return null;

    const barColor =
        noiseLevel >= speechThreshold
            ? '#ef4444'
            : noiseLevel >= noiseThreshold
                ? '#f59e0b'
                : '#10b981';

    return (
        <div
            className="fixed bottom-4 z-40 flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
                right: '148px', // Next to webcam monitor
                backgroundColor: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            {isActive ? (
                <Volume2 size={14} color={barColor} />
            ) : (
                <VolumeX size={14} color="#6b7280" />
            )}

            {/* Noise level bar */}
            <div
                style={{
                    width: '40px',
                    height: '6px',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        width: `${noiseLevel}%`,
                        height: '100%',
                        backgroundColor: barColor,
                        borderRadius: '3px',
                        transition: 'width 100ms ease',
                    }}
                />
            </div>

            {alertCount > 0 && (
                <span
                    style={{
                        fontSize: '9px',
                        color: '#f59e0b',
                        fontWeight: 600,
                    }}
                >
                    {alertCount}
                </span>
            )}
        </div>
    );
}
