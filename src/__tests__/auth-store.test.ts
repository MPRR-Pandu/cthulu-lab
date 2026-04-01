import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "../store/useAuthStore";

// Mock the auth API — apiLogout must return a promise
vi.mock("../lib/authApi", () => ({
  apiLogin: vi.fn().mockResolvedValue({ success: false }),
  apiRegister: vi.fn().mockResolvedValue({ success: false }),
  apiLogout: vi.fn().mockResolvedValue({ success: true }),
  apiRefreshToken: vi.fn().mockResolvedValue({ success: false }),
  apiGetMe: vi.fn().mockResolvedValue({ success: false }),
}));

// Mock localStorage for jsdom
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
});

describe("Auth Store", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it("starts unauthenticated", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it("clears error", () => {
    useAuthStore.setState({ error: "some error" });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it("logout clears all state", () => {
    useAuthStore.setState({
      user: { id: "1", email: "test@test.com", username: "test" },
      accessToken: "token",
      refreshToken: "refresh",
      isAuthenticated: true,
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("logout clears localStorage", () => {
    localStorage.setItem("auth_access_token", "token");
    localStorage.setItem("auth_refresh_token", "refresh");
    localStorage.setItem("auth_user", "{}");

    useAuthStore.getState().logout();

    expect(localStorage.getItem("auth_access_token")).toBeNull();
    expect(localStorage.getItem("auth_refresh_token")).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
  });
});
