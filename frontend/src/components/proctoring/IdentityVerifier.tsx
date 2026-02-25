import { useState, useRef, useCallback } from 'react';
import { Camera, Check, Upload, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';

interface IdentityVerifierProps {
    candidateToken: string;
    onVerified: () => void;
    onSkip?: () => void;
    required?: boolean;
}

/**
 * Pre-test identity verification flow:
 * 1. Capture selfie via webcam
 * 2. Optionally upload ID document
 * 3. Submit for verification
 */
export default function IdentityVerifier({
    candidateToken,
    onVerified,
    onSkip,
    required = false,
}: IdentityVerifierProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [step, setStep] = useState<'camera' | 'capture' | 'id' | 'submitting' | 'done'>('camera');
    const [selfieData, setSelfieData] = useState<string | null>(null);
    const [idDocData, setIdDocData] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [cameraReady, setCameraReady] = useState(false);

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, facingMode: 'user' },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setCameraReady(true);
            setError(null);
        } catch {
            setError('Camera access is required for identity verification');
        }
    }, []);

    const captureSelfie = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, 640, 480);
        const data = canvas.toDataURL('image/jpeg', 0.8);
        setSelfieData(data);
        setStep('capture');

        // Stop camera
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
        }
    }, []);

    const handleIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setIdDocData(reader.result as string);
        reader.readAsDataURL(file);
    };

    const submit = async () => {
        if (!selfieData) return;
        setStep('submitting');

        try {
            const res = await fetch('/api/v1/proctoring/verify-identity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${candidateToken}`,
                },
                body: JSON.stringify({
                    selfie_data: selfieData.split(',')[1],
                    id_document_data: idDocData ? idDocData.split(',')[1] : null,
                }),
            });

            if (res.ok) {
                setStep('done');
                setTimeout(onVerified, 1500);
            } else {
                setError('Verification submission failed. Please try again.');
                setStep('id');
            }
        } catch {
            setError('Network error. Please try again.');
            setStep('id');
        }
    };

    if (step === 'done') {
        return (
            <div
                className="fixed inset-0 z-50 flex items-center justify-center"
                style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
            >
                <div className="text-center p-8 rounded-2xl max-w-md" style={{ backgroundColor: 'var(--card-bg)' }}>
                    <div
                        className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}
                    >
                        <ShieldCheck size={36} color="#10b981" />
                    </div>
                    <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                        Identity Submitted
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Your identity verification has been submitted. You may now proceed with the assessment.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
        >
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div
                className="w-full max-w-lg rounded-2xl p-6"
                style={{
                    backgroundColor: 'var(--card-bg)',
                    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                    border: '1px solid var(--border)',
                }}
            >
                <div className="flex items-center gap-3 mb-5">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}
                    >
                        <ShieldCheck size={20} color="#6366f1" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                            Identity Verification
                        </h2>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {required ? 'Required before starting the assessment' : 'Recommended for assessment integrity'}
                        </p>
                    </div>
                </div>

                {/* Step indicators */}
                <div className="flex gap-2 mb-5">
                    {['Selfie', 'ID Document', 'Submit'].map((label, i) => {
                        const stepIndex = i;
                        const currentIndex = step === 'camera' ? 0 : step === 'capture' ? 1 : step === 'id' ? 1 : 2;
                        return (
                            <div key={label} className="flex-1">
                                <div
                                    className="h-1 rounded-full mb-1"
                                    style={{
                                        backgroundColor: stepIndex <= currentIndex ? '#6366f1' : 'var(--bg-secondary)',
                                    }}
                                />
                                <span className="text-xs" style={{ color: stepIndex <= currentIndex ? '#6366f1' : 'var(--text-muted)' }}>
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {error && (
                    <div
                        className="flex items-center gap-2 mb-4 p-3 rounded-lg"
                        style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                    >
                        <AlertCircle size={16} />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {/* Camera / Selfie step */}
                {(step === 'camera' || step === 'capture') && (
                    <div>
                        {step === 'camera' && (
                            <>
                                <div
                                    className="rounded-xl overflow-hidden mb-4"
                                    style={{
                                        aspectRatio: '4/3',
                                        backgroundColor: '#111',
                                        border: '2px solid var(--border)',
                                    }}
                                >
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    {!cameraReady ? (
                                        <button
                                            onClick={startCamera}
                                            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                                            style={{ backgroundColor: '#6366f1' }}
                                        >
                                            <Camera size={16} />
                                            Start Camera
                                        </button>
                                    ) : (
                                        <button
                                            onClick={captureSelfie}
                                            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                                            style={{ backgroundColor: '#10b981' }}
                                        >
                                            <Camera size={16} />
                                            Capture Selfie
                                        </button>
                                    )}
                                </div>
                            </>
                        )}

                        {step === 'capture' && selfieData && (
                            <>
                                <div
                                    className="rounded-xl overflow-hidden mb-4 relative"
                                    style={{ aspectRatio: '4/3', border: '2px solid #10b981' }}
                                >
                                    <img src={selfieData} alt="Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <div
                                        className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
                                        style={{ backgroundColor: '#10b981' }}
                                    >
                                        <Check size={16} color="#fff" />
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setSelfieData(null);
                                            setStep('camera');
                                            startCamera();
                                        }}
                                        className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer"
                                        style={{
                                            backgroundColor: 'var(--bg-secondary)',
                                            color: 'var(--text-primary)',
                                            border: '1px solid var(--border)',
                                        }}
                                    >
                                        Retake
                                    </button>
                                    <button
                                        onClick={() => setStep('id')}
                                        className="flex-1 py-3 rounded-xl text-white text-sm font-semibold cursor-pointer"
                                        style={{ backgroundColor: '#6366f1' }}
                                    >
                                        Continue
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ID Document step */}
                {step === 'id' && (
                    <div>
                        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                            Upload a government-issued photo ID (optional but recommended).
                        </p>
                        {idDocData ? (
                            <div
                                className="rounded-xl overflow-hidden mb-4 relative"
                                style={{ aspectRatio: '16/10', border: '2px solid #10b981' }}
                            >
                                <img src={idDocData} alt="ID Document" style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#f8f9fa' }} />
                                <div
                                    className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: '#10b981' }}
                                >
                                    <Check size={16} color="#fff" />
                                </div>
                            </div>
                        ) : (
                            <label
                                className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl cursor-pointer mb-4"
                                style={{
                                    border: '2px dashed var(--border)',
                                    backgroundColor: 'var(--bg-secondary)',
                                    color: 'var(--text-muted)',
                                }}
                            >
                                <Upload size={24} />
                                <span className="text-sm">Click to upload ID document</span>
                                <span className="text-xs">JPG, PNG — Max 5MB</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleIdUpload}
                                    className="hidden"
                                />
                            </label>
                        )}
                        <div className="flex gap-3">
                            {!required && (
                                <button
                                    onClick={() => {
                                        if (onSkip) onSkip();
                                        else submit();
                                    }}
                                    className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer"
                                    style={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border)',
                                    }}
                                >
                                    Skip ID Upload
                                </button>
                            )}
                            <button
                                onClick={submit}
                                className="flex-1 py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                                style={{ backgroundColor: '#10b981' }}
                            >
                                Submit Verification
                            </button>
                        </div>
                    </div>
                )}

                {/* Submitting */}
                {step === 'submitting' && (
                    <div className="text-center py-8">
                        <Loader2 size={32} className="animate-spin mx-auto mb-3" style={{ color: '#6366f1' }} />
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Submitting verification...
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
