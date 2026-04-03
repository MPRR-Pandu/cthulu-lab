const API_URL = "http://localhost:4000";

export interface OAuthStartResult {
  url: string;
  state: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export async function startOAuth(): Promise<OAuthStartResult | null> {
  try {
    const res = await fetch(`${API_URL}/oauth/start`, { method: "POST" });
    const data = await res.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(
  code: string,
  state: string
): Promise<{ tokens: OAuthTokens | null; error: string | null }> {
  try {
    const res = await fetch(`${API_URL}/oauth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    });
    const data = await res.json();
    if (data.success) {
      return { tokens: data.data, error: null };
    }
    return { tokens: null, error: data.error || "Exchange failed" };
  } catch (e) {
    return { tokens: null, error: String(e) };
  }
}
