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
      // Block PrintScreen
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        reportViolation('screenshot', 'Attempted screenshot');
        return;
      }
      // Block F12
      if (e.key === 'F12') {
        e.preventDefault();
        reportViolation('devtools', 'Attempted to open developer tools via F12');
        return;
      }
      // Block Ctrl+Shift+I/J/C (devtools shortcuts)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        reportViolation('devtools', `Attempted to open developer tools via Ctrl+Shift+${e.key.toUpperCase()}`);
        return;
      }
      // Block Ctrl+U (view source)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        reportViolation('devtools', 'Attempted to view page source');
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

    // --- Fullscreen enforcement ---
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
        // Re-enter fullscreen after a brief delay
        setTimeout(requestFullscreen, 1500);
      }
    };

    requestFullscreen();
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // --- Devtools detection via window resize heuristic ---
    let devtoolsOpen = false;
    const checkDevTools = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      const threshold = 160; // devtools panel is typically wider
      const isOpen = widthDiff > threshold || heightDiff > threshold;
      if (isOpen && !devtoolsOpen) {
        devtoolsOpen = true;
        reportViolation('devtools', 'Developer tools appear to be open');
      } else if (!isOpen) {
        devtoolsOpen = false;
      }
    };

    const devtoolsInterval = setInterval(checkDevTools, 2000);
    window.addEventListener('resize', checkDevTools);

    // --- Window blur detection (alt-tab, clicking outside) ---
    const handleBlur = () => {
      reportViolation('window_blur', 'Window lost focus');
    };
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopyPaste as EventListener);
      document.removeEventListener('cut', handleCopyPaste as EventListener);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearInterval(devtoolsInterval);
      window.removeEventListener('resize', checkDevTools);
      window.removeEventListener('blur', handleBlur);

      // Exit fullscreen on cleanup
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
    };
  }, [enabled, reportViolation]);
}
