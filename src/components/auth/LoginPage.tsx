import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const navigate = useNavigate();
  const location = useLocation();

  const successMsg = (location.state as { message?: string })?.message;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    const ok = await login(email, password);
    if (ok) navigate("/");
  };

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-[#5dadec] text-lg font-bold">{"> LOGIN_"}</h1>
        <p className="text-[#555] text-xs mt-1">authenticate to access command center</p>
      </div>

      {successMsg && (
        <div className="text-[#5dadec] text-xs mb-4 border border-[#333333] px-3 py-2">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="text-[#ff6b6b] text-xs mb-4 border border-[#ff6b6b]/30 px-3 py-2">
          [ERROR] {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="text-[#808080] text-xs block mb-1">EMAIL</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-transparent border-b border-[#555] text-[#e0e0e0] font-mono py-1.5 focus:border-[#5dadec] outline-none transition-colors"
            placeholder="user@domain.com"
          />
        </div>

        <div>
          <label className="text-[#808080] text-xs block mb-1">PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full bg-transparent border-b border-[#555] text-[#e0e0e0] font-mono py-1.5 focus:border-[#5dadec] outline-none transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#5dadec] text-black font-mono font-bold px-4 py-2 hover:bg-[#4a9ad9] disabled:opacity-50 transition-colors"
        >
          {isLoading ? "[■■■□□□] AUTHENTICATING..." : "[ENTER] LOGIN"}
        </button>
      </form>

      <div className="mt-6 text-xs">
        <Link to="/register" className="text-[#5dadec] hover:underline">
          {">"} CREATE ACCOUNT
        </Link>
      </div>
    </AuthLayout>
  );
}
