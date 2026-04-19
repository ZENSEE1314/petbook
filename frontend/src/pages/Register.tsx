import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(email, password, displayName || undefined);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="card p-6">
        <h1 className="mb-1 text-2xl font-bold">Join Petbook</h1>
        <p className="mb-6 text-sm text-slate-600">Free to join — browse the feed, post your pet, and shop.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Display name</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="How your pets want to be known" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">6 characters minimum.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          Already here? <Link to="/login" className="text-brand-600 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
