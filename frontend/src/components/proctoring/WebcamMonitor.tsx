import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, CameraOff } from 'lucide-react';

interface WebcamMonitorProps {
    candidateToken: string;
    intervalSeconds?: number;
    enabled: boolean;
}

/**
 * Webcam monitoring component that captures periodic snapshots
 * and sends them to the proctoring API.
 */
export default function WebcamMonitor({
    candidateToken,
    intervalSeconds = 30,
    enabled,
}: WebcamMonitorProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const captureAndSend = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = 320;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, 320, 240);
        const imageData = canvas.toDataURL('image/jpeg', 0.6);
        const base64 = imageData.split(',')[1];

        try {
            await fetch('/api/v1/proctoring/snapshot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${candidateToken}`,
                },
                body: JSON.stringify({
                    image_data: base64,
                    captured_at: new Date().toISOString(),
                    face_count: null, // Client-side face detection could be added
                }),
            });
        } catch {
            // Best effort — don't disrupt test
        }
    }, [candidateToken]);

    useEffect(() => {
        if (!enabled) return;

        const startWebcam = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 320, height: 240, facingMode: 'user' },
                });
                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setIsActive(true);
                setError(null);

                // Start periodic capture
                intervalRef.current = setInterval(captureAndSend, intervalSeconds * 1000);

                // Initial capture after 2s
                setTimeout(captureAndSend, 2000);
            } catch {
                setError('Camera access denied');
                setIsActive(false);
            }
        };

        startWebcam();

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, [enabled, intervalSeconds, captureAndSend]);

    if (!enabled) return null;

    return (
        <>
            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Small webcam indicator */}
            <div
                className="fixed bottom-4 right-4 z-40"
                style={{
                    width: '120px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: `2px solid ${isActive ? '#10b981' : '#ef4444'}`,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}
            >
                <div
                    className="relative"
                    style={{ aspectRatio: '4/3', backgroundColor: '#111' }}
                >
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transform: 'scaleX(-1)',
                        }}
                    />

                    {/* Recording indicator */}
                    <div
                        className="absolute top-1 left-1.5 flex items-center gap-1"
                        style={{ fontSize: '9px', color: '#fff' }}
                    >
                        <div
                            className="animate-pulse"
                            style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: isActive ? '#ef4444' : '#6b7280',
                            }}
                        />
                        <span style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                            {isActive ? 'REC' : 'OFF'}
                        </span>
                    </div>

                    {/* Status icon */}
                    <div className="absolute bottom-1 right-1.5" style={{ opacity: 0.8 }}>
                        {isActive ? (
                            <Camera size={12} color="#10b981" />
                        ) : (
                            <CameraOff size={12} color="#ef4444" />
                        )}
                    </div>
                </div>

                {error && (
                    <div
                        className="text-center py-1"
                        style={{
                            fontSize: '8px',
                            backgroundColor: 'rgba(239,68,68,0.9)',
                            color: '#fff',
                        }}
                    >
                        {error}
                    </div>
                )}
            </div>
        </>
    );
}
