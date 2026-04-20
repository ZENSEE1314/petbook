import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth";
import { PasswordInput } from "../components/PasswordInput";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState((params.get("ref") || "").toUpperCase());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(email, password, displayName || undefined, referralCode || undefined);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-4 sm:p-6">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow">Free forever</p>
        <h1 className="mb-1 mt-1 font-display text-3xl font-bold tracking-tight">Join Petbook</h1>
        <p className="mb-6 text-sm text-slate-600">Browse the feed, post your pet, and shop. Upgrade later to unlock care guides.</p>
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
            <PasswordInput required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="mt-1 text-xs text-slate-500">6 characters minimum.</p>
          </div>
          <div>
            <label className="label">Referral code <span className="text-xs font-normal text-slate-500">(optional)</span></label>
            <input
              className="input uppercase"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3D4"
            />
            <p className="mt-1 text-xs text-slate-500">Earn a welcome bonus — your friend also gets points.</p>
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
