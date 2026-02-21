import { create } from 'zustand';
import api from '../config/api';

interface BrandingState {
  organizationName: string | null;
  logoUrl: string | null;
  theme: Record<string, string>;
  loaded: boolean;
  loadBranding: (orgSlug: string) => Promise<void>;
  applyTheme: () => void;
  clearBranding: () => void;
}

export const useBrandingStore = create<BrandingState>((set, get) => ({
  organizationName: null,
  logoUrl: null,
  theme: {},
  loaded: false,

  loadBranding: async (orgSlug: string) => {
    try {
      const { data } = await api.get(`/organizations/branding/${orgSlug}`);
      set({
        organizationName: data.organization_name,
        logoUrl: data.logo_url,
        theme: data.theme || {},
        loaded: true,
      });
      get().applyTheme();
    } catch {
      set({ loaded: true });
    }
  },

  applyTheme: () => {
    const { theme } = get();
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme)) {
      if (value) {
        root.style.setProperty(`--${key}`, value);
      }
    }
  },

  clearBranding: () => {
    const { theme } = get();
    const root = document.documentElement;
    for (const key of Object.keys(theme)) {
      root.style.removeProperty(`--${key}`);
    }
    set({ organizationName: null, logoUrl: null, theme: {}, loaded: false });
  },
}));
