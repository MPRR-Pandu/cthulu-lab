import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../../store/useAuthStore";
import { AuthLayout } from "./AuthLayout";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const [success, setSuccess] = useState(false);
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError("");

    if (username.length < 3 || username.length > 30) {
      setValidationError("Username must be 3-30 characters");
      return;
    }

    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return;
    }

    const ok = await register(email, username, password);
    if (ok) setSuccess(true);
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center">
          <h1 className="text-[#5dadec] text-lg font-bold mb-4">{"> REGISTRATION_COMPLETE"}</h1>
          <div className="text-[#5dadec] text-xs border border-[#333333] px-3 py-4 mb-6">
            <p>Check your email for a verification link.</p>
            <p className="text-[#555] mt-2">Verify your account to gain access.</p>
          </div>
          <Link to="/login" className="text-[#5dadec] hover:underline text-xs">
            {"<"} BACK TO LOGIN
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-[#5dadec] text-lg font-bold">{"> REGISTER_"}</h1>
        <p className="text-[#555] text-xs mt-1">create a new operator account</p>
      </div>

      {(error || validationError) && (
        <div className="text-[#ff6b6b] text-xs mb-4 border border-[#ff6b6b]/30 px-3 py-2">
          [ERROR] {validationError || error}
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
          <label className="text-[#808080] text-xs block mb-1">USERNAME</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full bg-transparent border-b border-[#555] text-[#e0e0e0] font-mono py-1.5 focus:border-[#5dadec] outline-none transition-colors"
            placeholder="operator_name"
          />
          <span className="text-[#555] text-[10px]">3-30 characters</span>
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
          <span className="text-[#555] text-[10px]">minimum 8 characters</span>
        </div>

        <div>
          <label className="text-[#808080] text-xs block mb-1">CONFIRM PASSWORD</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
          {isLoading ? "[■■■□□□] CREATING..." : "[ENTER] REGISTER"}
        </button>
      </form>

      <div className="mt-6 text-xs">
        <Link to="/login" className="text-[#5dadec] hover:underline">
          {"<"} BACK TO LOGIN
        </Link>
      </div>
    </AuthLayout>
  );
}
