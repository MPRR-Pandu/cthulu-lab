import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { checkClaudeAuth } from "../../lib/claudeAuth";

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setChecked(true);
      return;
    }

    checkClaudeAuth()
      .then((status) => {
        if (status.loggedIn) {
          useAuthStore.getState().setUser({
            email: status.email,
            username: status.email.split("@")[0],
            subscription: status.subscriptionType,
          });
          useAuthStore.getState().setAuthenticated(true);
        }
        setChecked(true);
      })
      .catch(() => {
        setChecked(true);
      });
  }, [isAuthenticated]);

  if (!checked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center font-mono">
        <div className="text-center">
          <p className="text-[#5dadec] text-sm animate-pulse">[■■■□□□] CHECKING AUTH...</p>
          <p className="text-[#555] text-xs mt-2">verifying claude session</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
