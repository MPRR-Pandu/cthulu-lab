import type { ApiResponse, AuthResponse, User } from "../types/auth";

const BASE_URL = "http://localhost:4000";

async function authFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    const data = await response.json();
    return data as ApiResponse<T>;
  } catch {
    return { success: false, error: "Network error. Server may be offline." };
  }
}

function withAuth(token: string): { headers: Record<string, string> } {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export async function apiRegister(
  email: string,
  username: string,
  password: string
): Promise<ApiResponse<{ message: string }>> {
  return authFetch<{ message: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
  });
}

export async function apiLogin(
  email: string,
  password: string
): Promise<ApiResponse<AuthResponse>> {
  return authFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiRefreshToken(
  refreshToken: string
): Promise<ApiResponse<AuthResponse>> {
  return authFetch<AuthResponse>("/auth/refresh-token", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export async function apiLogout(
  accessToken: string
): Promise<ApiResponse<{ message: string }>> {
  return authFetch<{ message: string }>("/auth/logout", {
    method: "POST",
    ...withAuth(accessToken),
  });
}

export async function apiGetMe(
  accessToken: string
): Promise<ApiResponse<User>> {
  return authFetch<User>("/auth/me", {
    method: "GET",
    ...withAuth(accessToken),
  });
}
