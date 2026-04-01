import { create } from "zustand";
import type { User } from "../types/auth";
import {
  apiLogin,
  apiRegister,
  apiLogout,
  apiRefreshToken,
  apiGetMe,
} from "../lib/authApi";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshAuth: () => Promise<boolean>;
  clearError: () => void;
  initialize: () => Promise<void>;
}

const KEYS = {
  access: "auth_access_token",
  refresh: "auth_refresh_token",
  user: "auth_user",
} as const;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    const res = await apiLogin(email, password);

    if (res.success && res.data) {
      localStorage.setItem(KEYS.access, res.data.accessToken);
      localStorage.setItem(KEYS.refresh, res.data.refreshToken);
      localStorage.setItem(KEYS.user, JSON.stringify(res.data.user));
      set({
        user: res.data.user,
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    }

    set({ isLoading: false, error: res.error ?? "Login failed" });
    return false;
  },

  register: async (email, username, password) => {
    set({ isLoading: true, error: null });
    const res = await apiRegister(email, username, password);

    if (res.success) {
      set({ isLoading: false });
      return true;
    }

    set({ isLoading: false, error: res.error ?? "Registration failed" });
    return false;
  },

  logout: () => {
    const token = get().accessToken;
    if (token) {
      apiLogout(token).catch(() => {});
    }
    localStorage.removeItem(KEYS.access);
    localStorage.removeItem(KEYS.refresh);
    localStorage.removeItem(KEYS.user);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
  },

  refreshAuth: async () => {
    const refreshToken = localStorage.getItem(KEYS.refresh);
    if (!refreshToken) return false;

    const res = await apiRefreshToken(refreshToken);

    if (res.success && res.data) {
      localStorage.setItem(KEYS.access, res.data.accessToken);
      localStorage.setItem(KEYS.refresh, res.data.refreshToken);
      const existingUser = get().user;
      set({
        user: existingUser,
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        isAuthenticated: true,
      });
      return true;
    }

    return false;
  },

  clearError: () => set({ error: null }),

  initialize: async () => {
    const accessToken = localStorage.getItem(KEYS.access);
    const refreshToken = localStorage.getItem(KEYS.refresh);
    const userStr = localStorage.getItem(KEYS.user);

    if (!accessToken || !refreshToken || !userStr) {
      set({ isLoading: false });
      return;
    }

    set({ isLoading: true });

    const meRes = await apiGetMe(accessToken);

    if (meRes.success && meRes.data) {
      set({
        user: meRes.data,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });
      return;
    }

    const refreshed = await get().refreshAuth();

    if (!refreshed) {
      localStorage.removeItem(KEYS.access);
      localStorage.removeItem(KEYS.refresh);
      localStorage.removeItem(KEYS.user);
    }

    set({ isLoading: false });
  },
}));
