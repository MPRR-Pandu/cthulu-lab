import type { ApiResponse } from "../types/auth";

import { getApiUrl } from "./config";
const API_URL = getApiUrl();

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const accessToken = localStorage.getItem("auth_access_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    let response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && accessToken) {
      const refreshed = await attemptRefresh();
      if (refreshed) {
        headers["Authorization"] = `Bearer ${localStorage.getItem("auth_access_token")}`;
        response = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers,
        });
      }
    }

    const data = await response.json();
    return data as ApiResponse<T>;
  } catch {
    return { success: false, error: "Network error. Server may be offline." };
  }
}

async function attemptRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem("auth_refresh_token");
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_URL}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (data.success && data.data) {
      localStorage.setItem("auth_access_token", data.data.accessToken);
      localStorage.setItem("auth_refresh_token", data.data.refreshToken);
      return true;
    }
  } catch {
    // refresh failed
  }

  return false;
}
