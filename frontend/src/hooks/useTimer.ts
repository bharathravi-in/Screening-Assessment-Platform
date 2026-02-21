import { useEffect, useRef, useCallback } from 'react';
import { useTestStore } from '../store/testStore';

export function useTimer(onTimeUp: () => void) {
  const timeRemaining = useTestStore((s) => s.timeRemaining);
  const decrementTimer = useTestStore((s) => s.decrementTimer);
  const status = useTestStore((s) => s.status);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (status !== 'in_progress' || timeRemaining === null) return;

    intervalRef.current = setInterval(() => {
      const currentTime = useTestStore.getState().timeRemaining;
      if (currentTime !== null && currentTime <= 1) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        onTimeUpRef.current();
        return;
      }
      decrementTimer();
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, timeRemaining === null, decrementTimer]);

  const formatTime = useCallback((seconds: number | null): string => {
    if (seconds === null) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, []);

  const getTimerColor = useCallback((seconds: number | null): string => {
    if (seconds === null) return 'var(--text-primary)';
    if (seconds <= 60) return '#ef4444';
    if (seconds <= 300) return '#f59e0b';
    return 'var(--text-primary)';
  }, []);

  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    timerColor: getTimerColor(timeRemaining),
  };
}
