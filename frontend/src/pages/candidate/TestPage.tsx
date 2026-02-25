import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Send,
  AlertTriangle,
  Loader2,
  CloudOff,
  CheckCircle2,
  RefreshCcw,
} from 'lucide-react';
import { useTestStore } from '../../store/testStore';
import { useTimer } from '../../hooks/useTimer';
import { useProctoring } from '../../hooks/useProctoring';
import Timer from '../../components/test/Timer';
import QuestionNavigator from '../../components/test/QuestionNavigator';
import QuestionRenderer from '../../components/test/QuestionRenderer';
import toast from 'react-hot-toast';

const AUTO_SAVE_INTERVAL = 30_000; // 30 seconds

export default function TestPage() {
  const navigate = useNavigate();

  // Store selectors
  const sessionId = useTestStore((s) => s.sessionId);
  const status = useTestStore((s) => s.status);
  const questions = useTestStore((s) => s.questions);
  const currentQuestionIndex = useTestStore((s) => s.currentQuestionIndex);
  const responses = useTestStore((s) => s.responses);
  const violations = useTestStore((s) => s.violations);
  const maxViolations = useTestStore((s) => s.maxViolations);
  const proctoringConfig = useTestStore((s) => s.proctoringConfig);
  const loading = useTestStore((s) => s.loading);

  // Store actions
  const setCurrentQuestion = useTestStore((s) => s.setCurrentQuestion);
  const updateResponse = useTestStore((s) => s.updateResponse);
  const toggleFlag = useTestStore((s) => s.toggleFlag);
  const saveCurrentResponse = useTestStore((s) => s.saveCurrentResponse);
  const submitTest = useTestStore((s) => s.submitTest);

  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'offline'>('idle');
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const currentResponse = currentQuestion
    ? responses[currentQuestion.id]
    : undefined;

  // Count answered questions
  const answeredCount = questions.filter((q) => {
    const r = responses[q.id];
    return (
      (r?.selected_option_ids && r.selected_option_ids.length > 0) ||
      !!r?.text_response ||
      !!r?.code_response
    );
  }).length;

  // ----- Timer -----
  const handleTimeUp = useCallback(async () => {
    toast('Time is up! Submitting your assessment...', { icon: '⏰' });
    try {
      await submitTest();
      navigate('/test/complete');
    } catch {
      toast.error('Failed to submit. Please try manually.');
    }
  }, [submitTest, navigate]);

  const { formattedTime, timerColor } = useTimer(handleTimeUp);

  // ----- Proctoring -----
  const handleTerminated = useCallback(() => {
    toast.error('Assessment terminated due to excessive violations.');
    navigate('/test/complete');
  }, [navigate]);

  useProctoring({
    enabled: true,  // Always enforce baseline: fullscreen, tab-switch, devtools blocking
    onTerminated: handleTerminated,
  });

  // ----- Offline Tracking -----
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Syncing your progress...', { icon: '🌐' });
      setSaveStatus('idle');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSaveStatus('offline');
      toast.error('Working offline. Progress will sync when reconnected.', { duration: 5000, icon: '📡' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ----- Auto-save -----
  useEffect(() => {
    if (status !== 'in_progress') return;

    autoSaveRef.current = setInterval(async () => {
      if (!navigator.onLine) {
        setSaveStatus('offline');
        return;
      }

      const state = useTestStore.getState();
      const q = state.questions[state.currentQuestionIndex];
      if (q) {
        setSaveStatus('saving');
        try {
          await state.saveCurrentResponse(q.id);
          setSaveStatus('saved');
          setLastSaved(new Date());
          setTimeout(() => setSaveStatus('idle'), 3000);
        } catch {
          setSaveStatus('error');
        }
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [status, isOnline]);

  // ----- Redirect if no session -----
  useEffect(() => {
    if (!sessionId && status === 'not_started') {
      navigate('/');
    }
  }, [sessionId, status, navigate]);

  // ----- Navigation -----
  const handlePrev = () => {
    if (currentQuestion) {
      saveCurrentResponse(currentQuestion.id).catch(() => { });
    }
    setCurrentQuestion(currentQuestionIndex - 1);
  };

  const handleNext = () => {
    if (currentQuestion) {
      saveCurrentResponse(currentQuestion.id).catch(() => { });
    }
    setCurrentQuestion(currentQuestionIndex + 1);
  };

  const handleNavigate = (index: number) => {
    if (currentQuestion) {
      saveCurrentResponse(currentQuestion.id).catch(() => { });
    }
    setCurrentQuestion(index);
  };

  const handleToggleFlag = () => {
    if (currentQuestion) {
      toggleFlag(currentQuestion.id);
    }
  };

  // ----- Submit -----
  const handleSubmit = async () => {
    setShowSubmitConfirm(false);

    // Save current response before submitting
    if (currentQuestion) {
      try {
        await saveCurrentResponse(currentQuestion.id);
      } catch {
        // Continue with submit even if save fails
      }
    }

    try {
      await submitTest();
      navigate('/test/complete');
    } catch {
      toast.error('Submission failed. Please try again.');
    }
  };

  // ----- Response change -----
  const handleResponseChange = (update: {
    selected_option_ids?: string[];
    text_response?: string;
    code_response?: string;
    code_language?: string;
  }) => {
    if (currentQuestion) {
      updateResponse(currentQuestion.id, update);
    }
  };

  if (!currentQuestion) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ minHeight: 'calc(100vh - 56px)' }}
      >
        <Loader2
          size={32}
          className="animate-spin"
          style={{ color: 'var(--accent)' }}
        />
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col"
      style={{ minHeight: 'calc(100vh - 56px)' }}
    >
      {/* Top bar */}
      <div
        className="flex flex-col sm:flex-row items-center justify-between px-4 py-2 sm:py-2.5 border-b gap-2 sm:gap-0 shrink-0"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <Timer formattedTime={formattedTime} timerColor={timerColor} />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2">
            <span
              className="text-[10px] sm:text-xs font-medium px-2 py-0.5 sm:py-1 rounded whitespace-nowrap"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
              }}
            >
              {answeredCount}/{questions.length} answered
            </span>

            {/* Sync Status */}
            <div className="flex items-center gap-1.5 px-1 sm:px-0">
              {saveStatus === 'saving' && (
                <>
                  <RefreshCcw size={10} className="animate-spin text-blue-500" />
                  <span className="text-[10px] text-blue-500 font-medium">Saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <CheckCircle2 size={10} className="text-emerald-500" />
                  <span className="text-[10px] text-emerald-500 font-medium">Saved</span>
                </>
              )}
              {saveStatus === 'offline' && (
                <>
                  <CloudOff size={10} className="text-amber-500" />
                  <span className="text-[10px] text-amber-500 font-medium">Offline</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertTriangle size={10} className="text-rose-500" />
                  <span className="text-[10px] text-rose-500 font-medium">Error saving</span>
                </>
              )}
              {saveStatus === 'idle' && lastSaved && (
                <span className="text-[10px] text-gray-500">
                  Last saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          {/* Violations badge */}
          {violations > 0 && (
            <span
              className="text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full flex items-center gap-1.5"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--danger)',
              }}
            >
              <AlertTriangle size={12} />
              <span className="hidden xs:inline">{violations}/{maxViolations} Violations</span>
              <span className="xs:hidden">{violations}/{maxViolations}</span>
            </span>
          )}

          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={loading}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-lg text-white text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: '#10b981' }}
          >
            <Send size={14} />
            Submit
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Sidebar / Top Navigator on mobile */}
        <div
          className="w-full lg:w-56 lg:shrink-0 border-b lg:border-b-0 lg:border-r p-3 lg:p-4 overflow-x-auto lg:overflow-y-auto"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--border)',
          }}
        >
          <h3
            className="text-xs font-semibold uppercase tracking-wide mb-3 hidden lg:block"
            style={{ color: 'var(--text-muted)' }}
          >
            Questions
          </h3>
          <QuestionNavigator
            questions={questions}
            currentIndex={currentQuestionIndex}
            responses={responses}
            onNavigate={handleNavigate}
          />
        </div>

        {/* Right main area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Question content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto">
              {/* Question number */}
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-4"
                style={{ color: 'var(--text-muted)' }}
              >
                Question {currentQuestionIndex + 1} of {questions.length}
              </p>

              <QuestionRenderer
                question={currentQuestion}
                response={currentResponse ?? {}}
                onResponseChange={handleResponseChange}
              />
            </div>
          </div>

          {/* Bottom navigation bar */}
          <div
            className="flex items-center justify-between px-4 sm:px-6 py-3 border-t shrink-0 gap-2"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--border)',
            }}
          >
            <button
              onClick={handlePrev}
              disabled={currentQuestionIndex === 0}
              className="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-1.5 transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              <ChevronLeft size={16} />
              <span className="hidden xs:inline">Previous</span>
            </button>

            <button
              onClick={handleToggleFlag}
              className="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: currentResponse?.is_flagged
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'var(--bg-secondary)',
                color: currentResponse?.is_flagged
                  ? '#f59e0b'
                  : 'var(--text-secondary)',
                border: `1px solid ${currentResponse?.is_flagged ? '#f59e0b' : 'var(--border)'}`,
              }}
            >
              <Flag size={14} />
              <span className="hidden xs:inline">{currentResponse?.is_flagged ? 'Flagged' : 'Flag for Review'}</span>
              <span className="xs:hidden">{currentResponse?.is_flagged ? 'Flag' : 'Flag'}</span>
            </button>

            <button
              onClick={handleNext}
              disabled={currentQuestionIndex === questions.length - 1}
              className="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-1.5 transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              style={{
                backgroundColor: 'var(--accent)',
                color: '#fff',
              }}
            >
              <span className="hidden xs:inline">Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Submit confirmation modal */}
      {showSubmitConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        >
          <div
            className="w-full max-w-sm rounded-xl p-6"
            style={{
              backgroundColor: 'var(--card-bg)',
              boxShadow: 'var(--card-shadow)',
              border: '1px solid var(--border)',
            }}
          >
            <h3
              className="text-lg font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              Submit Assessment?
            </h3>
            <p
              className="text-sm mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              You have answered {answeredCount} of {questions.length} questions.
            </p>
            {answeredCount < questions.length && (
              <p
                className="text-sm mb-4"
                style={{ color: '#f59e0b' }}
              >
                {questions.length - answeredCount} question
                {questions.length - answeredCount !== 1 ? 's' : ''} remain
                unanswered.
              </p>
            )}
            {answeredCount === questions.length && <div className="mb-4" />}
            <p
              className="text-xs mb-5"
              style={{ color: 'var(--text-muted)' }}
            >
              Once submitted, you cannot go back to change your answers.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#10b981' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Confirm Submit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
