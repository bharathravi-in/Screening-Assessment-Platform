import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckSquare,
  MonitorOff,
  Clipboard,
  Maximize,
  MousePointer,
} from 'lucide-react';
import { testService } from '../../services/testService';
import { useTestStore } from '../../store/testStore';
import toast from 'react-hot-toast';

const generalRules = [
  'Read each question carefully before answering.',
  'You can navigate between questions using the question navigator.',
  'You can flag questions for review and return to them later.',
  'Your responses are auto-saved periodically.',
  'Once you submit the test, you cannot go back and change your answers.',
  'Do not refresh the browser during the test as it may cause issues.',
];

const proctoringRules = [
  { icon: MonitorOff, text: 'Do not switch tabs or minimize the browser window.' },
  { icon: Maximize, text: 'The test will run in fullscreen mode. Do not exit fullscreen.' },
  { icon: Clipboard, text: 'Copy, paste, and cut operations are restricted.' },
  { icon: MousePointer, text: 'Right-click is disabled during the test.' },
];

export default function InstructionsPage() {
  const navigate = useNavigate();
  const invitationToken = useTestStore((s) => s.invitationToken);
  const startTest = useTestStore((s) => s.startTest);

  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleBeginAssessment = async () => {
    if (!invitationToken) {
      toast.error('Session expired. Please use your invitation link again.');
      navigate('/');
      return;
    }

    setLoading(true);
    try {
      const data = await testService.start(invitationToken);
      startTest(data);
      navigate('/test/resume');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(detail || 'Failed to start the assessment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Redirect if no invitation token in store
  if (!invitationToken) {
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
          <AlertTriangle
            size={40}
            className="mx-auto mb-4"
            style={{ color: 'var(--danger)' }}
          />
          <h2
            className="text-lg font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            No Active Session
          </h2>
          <p
            className="text-sm mb-4"
            style={{ color: 'var(--text-secondary)' }}
          >
            Please use your invitation link to access the assessment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex items-center justify-center px-4 py-6 sm:py-8"
      style={{ minHeight: 'calc(100vh - 56px)' }}
    >
      <div
        className="w-full max-w-2xl rounded-xl p-5 sm:p-8"
        style={{
          backgroundColor: 'var(--card-bg)',
          boxShadow: 'var(--card-shadow)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="p-2.5 rounded-lg"
            style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
          >
            <BookOpen size={22} style={{ color: '#3b82f6' }} />
          </div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            Assessment Instructions
          </h1>
        </div>

        {/* General rules */}
        <div className="mb-6">
          <h2
            className="text-sm font-semibold uppercase tracking-wide mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            General Rules
          </h2>
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <ul className="flex flex-col gap-2.5">
              {generalRules.map((rule, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: '#fff',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className="text-sm leading-relaxed"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {rule}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Proctoring rules */}
        <div className="mb-6">
          <h2
            className="text-sm font-semibold uppercase tracking-wide mb-3 flex items-center gap-2"
            style={{ color: 'var(--text-muted)' }}
          >
            <ShieldCheck size={16} />
            Proctoring Rules
          </h2>
          <div
            className="rounded-lg p-4"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.06)',
              border: '1px solid #f59e0b40',
            }}
          >
            <ul className="flex flex-col gap-3">
              {proctoringRules.map((rule, i) => (
                <li key={i} className="flex items-center gap-3">
                  <rule.icon
                    size={18}
                    className="shrink-0"
                    style={{ color: '#f59e0b' }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {rule.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Consent checkbox */}
        <label
          className="flex items-start gap-3 mb-6 cursor-pointer select-none"
        >
          <input
            type="checkbox"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
            className="mt-0.5"
            style={{ accentColor: 'var(--accent)' }}
          />
          <span
            className="text-sm leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            I have read and understood the instructions and rules above. I agree
            to take the assessment under the specified conditions including
            proctoring monitoring.
          </span>
        </label>

        {/* Begin button */}
        <button
          onClick={handleBeginAssessment}
          disabled={!consentChecked || loading}
          className="w-full py-3 rounded-lg text-white font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Starting Assessment...
            </>
          ) : (
            <>
              <CheckSquare size={16} />
              Begin Assessment
            </>
          )}
        </button>
      </div>
    </div>
  );
}
