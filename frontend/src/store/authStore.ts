import { create } from 'zustand';
import api from '../config/api';
import type { LoginPayload, TokenResponse } from '../types/auth';

// Keys for localStorage persistence
const LS_REFRESH = 'refresh_token';
const LS_ACCESS = 'access_token';
const LS_USER = 'auth_user'; // JSON: { userId, fullName, role, organizationId }

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  userId: string | null;
  fullName: string | null;
  role: 'super_admin' | 'admin' | 'hr' | 'tech' | null;
  organizationId: string | null;
  isAuthenticated: boolean;

  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  initialize: () => void;
}

function saveSession(data: TokenResponse) {
  localStorage.setItem(LS_REFRESH, data.refresh_token);
  localStorage.setItem(LS_ACCESS, data.access_token);
  localStorage.setItem(LS_USER, JSON.stringify({
    userId: data.user_id,
    fullName: data.full_name,
    role: data.role,
    organizationId: data.organization_id ?? null,
  }));
}

function clearSession() {
  localStorage.removeItem(LS_REFRESH);
  localStorage.removeItem(LS_ACCESS);
  localStorage.removeItem(LS_USER);
}

// ---------------------------------------------------------------------------
// Synchronous initializer — runs once when this module is first imported,
// BEFORE React renders any component. This ensures localStorage state is
// restored on the very first render so ProtectedRoute never flashes /login.
// ---------------------------------------------------------------------------
let _initialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  userId: null,
  fullName: null,
  role: null,
  organizationId: null,
  isAuthenticated: false,

  login: async (payload: LoginPayload) => {
    const response = await api.post<TokenResponse>('/auth/login', payload);
    const data = response.data;
    saveSession(data);
    set({
      token: data.access_token,
      refreshToken: data.refresh_token,
      userId: data.user_id,
      fullName: data.full_name,
      role: data.role as AuthState['role'],
      organizationId: data.organization_id ?? null,
      isAuthenticated: true,
    });
  },

  logout: () => {
    const token = get().token;
    if (token) {
      api.post('/auth/logout').catch(() => { });
    }
    clearSession();
    set({
      token: null,
      refreshToken: null,
      userId: null,
      fullName: null,
      role: null,
      organizationId: null,
      isAuthenticated: false,
    });
  },

  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(LS_ACCESS, accessToken);
    localStorage.setItem(LS_REFRESH, refreshToken);
    set({ token: accessToken, refreshToken });
  },

  initialize: () => {
    // 1. Restore persisted user identity synchronously so UI renders immediately
    const storedUser = localStorage.getItem(LS_USER);
    const storedAccess = localStorage.getItem(LS_ACCESS);
    const storedRefresh = localStorage.getItem(LS_REFRESH);

    if (storedUser && storedRefresh) {
      try {
        const u = JSON.parse(storedUser);
        set({
          token: storedAccess,
          refreshToken: storedRefresh,
          userId: u.userId,
          fullName: u.fullName,
          role: u.role,
          organizationId: u.organizationId,
          isAuthenticated: true,
        });
      } catch {
        clearSession();
        return;
      }

      // 2. Silently refresh the access token in the background
      api
        .post<TokenResponse>('/auth/refresh', { refresh_token: storedRefresh })
        .then((response) => {
          const data = response.data;
          saveSession(data);
          set({
            token: data.access_token,
            refreshToken: data.refresh_token,
            userId: data.user_id,
            fullName: data.full_name,
            role: data.role as AuthState['role'],
            organizationId: data.organization_id ?? null,
            isAuthenticated: true,
          });
        })
        .catch((err) => {
          // Only log out if it's a 401/403 or specific auth error
          // Don't log out on network 5xx or connection patterns
          if (err.response && (err.response.status === 401 || err.response.status === 403)) {
            clearSession();
            set({
              token: null,
              refreshToken: null,
              userId: null,
              fullName: null,
              role: null,
              organizationId: null,
              isAuthenticated: false,
            });
          }
        });
    }
  },
}));

// Run once synchronously at import time (before any React render)
if (!_initialized) {
  _initialized = true;
  useAuthStore.getState().initialize();
}
