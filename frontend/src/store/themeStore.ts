import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const stored = localStorage.getItem('theme') as Theme | null;
  const initial = stored || 'light';
  document.documentElement.setAttribute('data-theme', initial);

  return {
    theme: initial,

    toggle: () => {
      set((state) => {
        const next = state.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        return { theme: next };
      });
    },

    setTheme: (theme: Theme) => {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('theme', theme);
      set({ theme });
    },
  };
});
