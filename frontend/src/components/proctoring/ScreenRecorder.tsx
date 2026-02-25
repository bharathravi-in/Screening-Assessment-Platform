import { useEffect, useRef, useState } from 'react';

interface ScreenRecorderProps {
    candidateToken: string;
    enabled: boolean;
}

/**
 * Screen recording component using getDisplayMedia and MediaRecorder.
 * Records the candidate's screen and uploads chunks to the backend.
 */
export default function ScreenRecorder({
    candidateToken,
    enabled,
}: ScreenRecorderProps) {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const [isRecording, setIsRecording] = useState(false);

    useEffect(() => {
        if (!enabled) return;

        const startRecording = async () => {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { frameRate: 1 }, // Low framerate for bandwidth
                    audio: false,
                });
                streamRef.current = stream;

                // Detect when user stops sharing
                stream.getVideoTracks()[0].addEventListener('ended', () => {
                    setIsRecording(false);
                    // Report as violation — they stopped sharing
                    fetch('/api/v1/proctoring/event', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${candidateToken}`,
                        },
                        body: JSON.stringify({
                            event_type: 'screen_share_stopped',
                            severity: 'critical',
                            details: 'Candidate stopped screen sharing',
                            client_timestamp: new Date().toISOString(),
                        }),
                    }).catch(() => { });
                });

                const recorder = new MediaRecorder(stream, {
                    mimeType: 'video/webm;codecs=vp8',
                    videoBitsPerSecond: 100_000, // Very low bitrate
                });

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunksRef.current.push(e.data);
                    }
                };

                // Upload chunks every 60 seconds
                recorder.onstop = () => {
                    uploadChunks();
                };

                recorder.start(60_000); // Request data every 60s
                mediaRecorderRef.current = recorder;
                setIsRecording(true);
            } catch {
                // User denied screen sharing — report
                fetch('/api/v1/proctoring/event', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${candidateToken}`,
                    },
                    body: JSON.stringify({
                        event_type: 'screen_share_denied',
                        severity: 'warning',
                        details: 'Candidate denied screen sharing permission',
                        client_timestamp: new Date().toISOString(),
                    }),
                }).catch(() => { });
            }
        };

        const uploadChunks = async () => {
            if (chunksRef.current.length === 0) return;
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            chunksRef.current = [];

            // Convert to base64 for upload via JSON
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                try {
                    await fetch('/api/v1/proctoring/event', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${candidateToken}`,
                        },
                        body: JSON.stringify({
                            event_type: 'screen_recording_chunk',
                            severity: 'info',
                            details: `Screen recording chunk: ${(blob.size / 1024).toFixed(0)}KB`,
                            metadata: {
                                chunk_size_bytes: blob.size,
                                recording_data: base64.substring(0, 100_000), // Limit chunk size
                            },
                            client_timestamp: new Date().toISOString(),
                        }),
                    });
                } catch {
                    // Best effort
                }
            };
            reader.readAsDataURL(blob);
        };

        startRecording();

        return () => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, [enabled, candidateToken]);

    if (!enabled) return null;

    // Small indicator — mostly invisible
    return (
        <div
            className="fixed bottom-20 right-4 z-40 flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{
                backgroundColor: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                fontSize: '9px',
                color: isRecording ? '#10b981' : '#f59e0b',
            }}
        >
            <div
                className={isRecording ? 'animate-pulse' : ''}
                style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    backgroundColor: isRecording ? '#10b981' : '#f59e0b',
                }}
            />
            {isRecording ? 'Screen shared' : 'Screen not shared'}
        </div>
    );
}
