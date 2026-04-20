import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { PasswordInput } from "../components/PasswordInput";

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      alert("Password updated. You can now log in.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-2xl font-bold">Invalid reset link</h1>
        <p className="mt-2 text-sm text-slate-600">The link is missing a token. Request a new one.</p>
        <Link to="/forgot-password" className="btn-primary mt-4 inline-flex">
          Request reset
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4 sm:p-6">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow">New password</p>
        <h1 className="mb-1 mt-1 font-display text-3xl font-bold tracking-tight">Set your new password</h1>
        <p className="mb-6 text-sm text-slate-600">
          Minimum 6 characters. You'll be logged out everywhere after updating.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">New password</label>
            <PasswordInput required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <PasswordInput required minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
