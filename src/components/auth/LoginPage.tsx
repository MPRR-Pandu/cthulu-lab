import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { checkClaudeAuth } from "../../lib/claudeAuth";
import { getConfig, setConfig } from "../../lib/config";
import { ipc } from "../../lib/ipc";
import { AuthLayout } from "./AuthLayout";

type ConnStatus = "idle" | "testing" | "connected" | "failed";

export function LoginPage() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const config = getConfig();
  const [apiUrl, setApiUrl] = useState(config.apiUrl);
  const [apiStatus, setApiStatus] = useState<ConnStatus>("idle");
  const [apiError, setApiError] = useState("");
  const [apiInfo, setApiInfo] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState(config.gatewayUrl);
  const [gwStatus, setGwStatus] = useState<ConnStatus>("idle");
  const [gwError, setGwError] = useState("");
  const [gwInfo, setGwInfo] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setChecking(true);
    setError(null);
    try {
      const status = await checkClaudeAuth();

      if (status.loggedIn) {
        if (status.email && !status.email.endsWith("@bitcoin.com")) {
          setError(`Access denied. Only @bitcoin.com accounts are allowed. (${status.email})`);
          return;
        }

        setLoggedIn(true);
        useAuthStore.getState().setUser({
          email: status.email || "claude-user",
          username: status.email ? status.email.split("@")[0] : "claude-user",
          subscription: status.subscriptionType || status.authMethod,
        });
        useAuthStore.getState().setAuthenticated(true);
      } else {
        setError("Not authenticated. Run 'claude auth login' in your terminal first.");
      }
    } catch (err) {
      setError(`Auth check failed: ${String(err)}`);
    } finally {
      setChecking(false);
    }
  };

  const handleCopyCommand = () => {
    navigator.clipboard.writeText("claude auth login").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleEnter = () => {
    const trimmedApi = apiUrl.trim();
    const trimmedGw = gatewayUrl.trim();
    if (trimmedApi !== config.apiUrl || trimmedGw !== config.gatewayUrl) {
      setConfig({ apiUrl: trimmedApi, gatewayUrl: trimmedGw });
    }
    navigate("/");
  };

  const testApi = async () => {
    const url = apiUrl.trim();
    if (!url) return;
    setApiStatus("testing");
    setApiError("");
    setApiInfo("");
    try {
      const result = await ipc.testApiConnection(url);
      setApiStatus("connected");
      setApiInfo(result);
      setConfig({ apiUrl: url });
    } catch (err) {
      setApiStatus("failed");
      setApiError(String(err));
    }
  };

  const testGateway = async () => {
    const url = gatewayUrl.trim();
    if (!url) return;
    setGwStatus("testing");
    setGwError("");
    setGwInfo("");
    try {
      const result = await ipc.testGatewayConnection(url);
      setGwStatus("connected");
      setGwInfo(result);
      setConfig({ gatewayUrl: url });
    } catch (err) {
      setGwStatus("failed");
      setGwError(String(err));
    }
  };

  const statusLabel = (s: ConnStatus) => {
    switch (s) {
      case "testing": return <span className="text-[#e8d44d] animate-pulse">testing...</span>;
      case "connected": return <span className="text-[#5ddb6e]">connected</span>;
      case "failed": return <span className="text-[#f06060]">failed</span>;
      default: return null;
    }
  };

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-[#5dadec] text-lg font-bold text-glow">{"> CTHULU LAB_"}</h1>
        <p className="text-[#555] text-xs mt-1">authenticate with your Claude account</p>
      </div>

      {error && (
        <div className="text-[#ff6b6b] text-xs mb-4 border border-[#ff6b6b]/30 px-3 py-2 break-all">
          [ERROR] {error}
        </div>
      )}

      {checking ? (
        <div className="text-center py-8">
          <p className="text-[#5dadec] text-sm animate-pulse">[■■■□□□] CHECKING AUTH...</p>
          <p className="text-[#555] text-xs mt-2">running claude auth status</p>
        </div>
      ) : loggedIn ? (
        <div className="space-y-4">
          <div className="text-center py-4">
            <p className="text-[#5ddb6e] text-sm">[✓] AUTHENTICATED</p>
          </div>

          {/* Connection config */}
          <div className="border border-[#222] p-3 bg-[#0a0a0a]">
            <div className="text-[#808080] text-[10px] mb-2">── CONNECTIONS (optional) ──</div>

            <div className="mb-2">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[#555] text-[10px]">Backend API</span>
                {statusLabel(apiStatus)}
              </div>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => { setApiUrl(e.target.value); setApiStatus("idle"); setApiError(""); setApiInfo(""); }}
                  placeholder="http://localhost:3000/api"
                  className="flex-1 bg-black border border-[#333] text-[#e0e0e0] placeholder-[#333] px-2 py-1 font-mono text-[10px] focus:outline-none focus:border-[#4de8e0]"
                />
                <button
                  onClick={testApi}
                  disabled={apiStatus === "testing" || !apiUrl.trim()}
                  className="px-2 py-1 border border-[#333] text-[10px] text-[#4de8e0] hover:border-[#4de8e0]/50 disabled:opacity-30"
                >
                  TEST
                </button>
              </div>
              {apiError && <div className="text-[#f06060] text-[10px] mt-0.5">{apiError}</div>}
              {apiInfo && <div className="text-[#5ddb6e] text-[10px] mt-0.5">{apiInfo}</div>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[#555] text-[10px]">VM Gateway</span>
                {statusLabel(gwStatus)}
              </div>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={gatewayUrl}
                  onChange={(e) => { setGatewayUrl(e.target.value); setGwStatus("idle"); setGwError(""); setGwInfo(""); }}
                  placeholder="https://your-gateway:8080"
                  className="flex-1 bg-black border border-[#333] text-[#e0e0e0] placeholder-[#333] px-2 py-1 font-mono text-[10px] focus:outline-none focus:border-[#4de8e0]"
                />
                <button
                  onClick={testGateway}
                  disabled={gwStatus === "testing" || !gatewayUrl.trim()}
                  className="px-2 py-1 border border-[#333] text-[10px] text-[#4de8e0] hover:border-[#4de8e0]/50 disabled:opacity-30"
                >
                  TEST
                </button>
              </div>
              {gwError && <div className="text-[#f06060] text-[10px] mt-0.5">{gwError}</div>}
              {gwInfo && <div className="text-[#5ddb6e] text-[10px] mt-0.5">{gwInfo}</div>}
            </div>

            <div className="text-[#333] text-[10px] mt-2">
              can be changed later in settings
            </div>
          </div>

          <button
            onClick={handleEnter}
            className="w-full bg-[#4de8e0] text-black font-mono font-bold px-4 py-2.5 hover:bg-[#3dd4cc] transition-colors glow-active-pulse"
          >
            [▶] TAKE ME IN
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-[#333] p-4 bg-[#0a0a0a]">
            <div className="text-[#808080] text-xs mb-3">
              Run this in your terminal to login:
            </div>

            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 bg-[#111] border border-[#333] px-3 py-2 text-[#4de8e0] text-sm">
                claude auth login
              </code>
              <button
                onClick={handleCopyCommand}
                className="px-2 py-2 border border-[#333] text-[#808080] hover:text-[#4de8e0] hover:border-[#4de8e0]/40 text-xs glow-hover"
              >
                {copied ? "✓" : "COPY"}
              </button>
            </div>

            <div className="text-[#555] text-[10px] space-y-1">
              <p>1. Open Terminal</p>
              <p>2. Run <span className="text-[#4de8e0]">claude auth login</span></p>
              <p>3. Login with your Claude Pro/Max account in the browser</p>
              <p>4. Come back here and click CHECK below</p>
            </div>
          </div>

          <button
            onClick={checkAuth}
            className="w-full bg-[#4de8e0] text-black font-mono font-bold px-4 py-2.5 hover:bg-[#3dd4cc] transition-colors glow-active-pulse"
          >
            [⟳] CHECK LOGIN STATUS
          </button>

          <div className="text-[#333] text-[10px] text-center">
            requires Claude Pro or Max subscription
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
