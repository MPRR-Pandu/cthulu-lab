import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { checkClaudeAuth } from "../../lib/claudeAuth";
import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setChecking(true);
    setError(null);
    try {
      const status = await checkClaudeAuth();

      if (status.loggedIn) {
        setLoggedIn(true);
        useAuthStore.getState().setUser({
          email: status.email,
          username: status.email.split("@")[0],
          subscription: status.subscriptionType,
        });
        useAuthStore.getState().setAuthenticated(true);
        setTimeout(() => navigate("/"), 500);
      }
    } catch (err) {
      setError(String(err));
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
        <div className="text-center py-8">
          <p className="text-[#5ddb6e] text-sm">[✓] AUTHENTICATED</p>
          <p className="text-[#555] text-xs mt-2 animate-pulse">redirecting...</p>
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
