import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, AlertTriangle, Clock, FileText, User } from 'lucide-react';
import { testService } from '../../services/testService';
import { useTestStore } from '../../store/testStore';
import type { TestVerifyResponse } from '../../types/test';

export default function VerifyPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setInvitationToken = useTestStore((s) => s.setInvitationToken);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verifyData, setVerifyData] = useState<TestVerifyResponse | null>(null);

  useEffect(() => {
    if (!token) {
      setError('No invitation token provided.');
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const data = await testService.verify(token);
        setVerifyData(data);
        setInvitationToken(token);
      } catch (err: any) {
        const status = err.response?.status;
        const detail = err.response?.data?.detail;

        if (status === 404) {
          setError('This invitation link is invalid or does not exist.');
        } else if (status === 410 || detail?.includes('expired')) {
          setError('This invitation has expired. Please contact your recruiter for a new link.');
        } else if (detail?.includes('already')) {
          setError('This assessment has already been completed.');
        } else {
          setError(detail || 'Failed to verify invitation. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token, setInvitationToken]);

  const handleProceed = () => {
    navigate('/test/instructions');
  };

  if (loading) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ minHeight: 'calc(100vh - 56px)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2
            size={40}
            className="animate-spin"
            style={{ color: 'var(--accent)' }}
          />
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Verifying your invitation...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex-1 flex items-center justify-center px-4"
        style={{ minHeight: 'calc(100vh - 56px)' }}
      >
        <div
          className="w-full max-w-md rounded-xl p-8 text-center"
          style={{
            backgroundColor: 'var(--card-bg)',
            boxShadow: 'var(--card-shadow)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
          >
            <AlertTriangle size={28} style={{ color: 'var(--danger)' }} />
          </div>
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            Verification Failed
          </h2>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!verifyData) return null;

  return (
    <div
      className="flex-1 flex items-center justify-center px-4 py-8"
      style={{ minHeight: 'calc(100vh - 56px)' }}
    >
      <div
        className="w-full max-w-lg rounded-xl p-8"
        style={{
          backgroundColor: 'var(--card-bg)',
          boxShadow: 'var(--card-shadow)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            {verifyData.assessment_title}
          </h1>
          {verifyData.assessment_description && (
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {verifyData.assessment_description}
            </p>
          )}
        </div>

        {/* Assessment details */}
        <div
          className="rounded-lg p-4 mb-6 flex flex-col gap-3"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-3">
            <User size={16} style={{ color: 'var(--text-muted)' }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Candidate
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {verifyData.candidate_name} ({verifyData.candidate_email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <FileText size={16} style={{ color: 'var(--text-muted)' }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Questions
              </p>
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--text-primary)' }}
              >
                {verifyData.total_questions} questions
              </p>
            </div>
          </div>

          {verifyData.time_limit_minutes && (
            <div className="flex items-center gap-3">
              <Clock size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Time Limit
                </p>
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {verifyData.time_limit_minutes} minutes
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Proctoring notice */}
        {verifyData.proctoring_enabled && (
          <div
            className="rounded-lg p-4 mb-6 flex items-start gap-3"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid #f59e0b',
            }}
          >
            <ShieldCheck
              size={20}
              className="shrink-0 mt-0.5"
              style={{ color: '#f59e0b' }}
            />
            <div>
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: '#f59e0b' }}
              >
                Proctoring Enabled
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                This assessment is monitored. Tab switching, copy/paste, and
                exiting fullscreen will be tracked as violations. Excessive
                violations may result in automatic termination.
              </p>
            </div>
          </div>
        )}

        {/* Proceed button */}
        <button
          onClick={handleProceed}
          className="w-full py-3 rounded-lg text-white font-medium text-sm transition-colors cursor-pointer"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          Proceed to Instructions
        </button>
      </div>
    </div>
  );
}
