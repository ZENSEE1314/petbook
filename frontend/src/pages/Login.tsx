import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from ?? "/";
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-4 sm:p-6">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow">Welcome back</p>
        <h1 className="mb-1 mt-1 font-display text-3xl font-bold tracking-tight">Log in to Petbook</h1>
        <p className="mb-6 text-sm text-slate-600">Share photos, shop for treats, and unlock the pet guide.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          New here? <Link to="/register" className="text-brand-600 hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
