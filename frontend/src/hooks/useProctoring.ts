import { useEffect, useRef, useCallback } from 'react';
import { useTestStore } from '../store/testStore';
import { testService } from '../services/testService';

interface ProctoringOptions {
  enabled: boolean;
  onTerminated: () => void;
}

export function useProctoring({ enabled, onTerminated }: ProctoringOptions) {
  const addViolation = useTestStore((s) => s.addViolation);
  const setTerminated = useTestStore((s) => s.setTerminated);
  const onTerminatedRef = useRef(onTerminated);
  onTerminatedRef.current = onTerminated;

  const reportViolation = useCallback(
    async (type: string, details?: string) => {
      addViolation();
      try {
        const result = await testService.reportViolation(type, details);
        if (result.is_terminated) {
          setTerminated();
          onTerminatedRef.current();
        }
      } catch {
        // Best effort
      }
    },
    [addViolation, setTerminated]
  );

  useEffect(() => {
    if (!enabled) return;

    // Tab switch / visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation('tab_switch', 'Candidate switched tabs or minimized window');
      }
    };

    // Right-click disable
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportViolation('right_click', 'Attempted right-click');
    };

    // Copy/paste/cut block
    const handleCopyPaste = (e: ClipboardEvent) => {
      // Allow paste in code editors
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.closest('.monaco-editor')) {
        return;
      }
      e.preventDefault();
      reportViolation('clipboard', `Attempted ${e.type}`);
    };

    // Keyboard restrictions
    const handleKeyDown = (e: KeyboardEvent) => {
      // Block Ctrl+C/V/A outside code editors, PrintScreen, F12
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        reportViolation('screenshot', 'Attempted screenshot');
        return;
      }
      if (e.key === 'F12') {
        e.preventDefault();
        reportViolation('devtools', 'Attempted to open developer tools');
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        const target = e.target as HTMLElement;
        const inEditor = target.tagName === 'TEXTAREA' || target.closest('.monaco-editor');
        if (['a', 'A'].includes(e.key) && !inEditor) {
          e.preventDefault();
          reportViolation('select_all', 'Attempted select all');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopyPaste as EventListener);
    document.addEventListener('cut', handleCopyPaste as EventListener);
    document.addEventListener('keydown', handleKeyDown);

    // Try to request fullscreen
    const requestFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fullscreen may not be supported
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportViolation('fullscreen_exit', 'Exited fullscreen mode');
      }
    };

    requestFullscreen();
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste as EventListener);
      document.removeEventListener('cut', handleCopyPaste as EventListener);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);

      // Exit fullscreen on cleanup
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [enabled, reportViolation]);
}
