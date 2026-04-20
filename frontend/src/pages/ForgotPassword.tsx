import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-4 sm:p-6">
      <div className="card p-6 sm:p-8">
        <p className="eyebrow">Account recovery</p>
        <h1 className="mb-1 mt-1 font-display text-3xl font-bold tracking-tight">Forgot password?</h1>
        {done ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg bg-sage-50 p-4 text-sm text-sage-700">
              If an account exists for <strong>{email}</strong>, we've sent a reset link. It expires in
              1 hour. Check your inbox (and spam folder).
            </div>
            <p className="text-sm text-slate-600">
              No email received?{" "}
              <button className="text-brand-600 underline" onClick={() => setDone(false)}>
                Try again
              </button>
              . If SMTP isn't configured on this Petbook instance, ask the admin to check server
              logs for your reset link.
            </p>
            <Link to="/login" className="btn-secondary inline-flex">
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-600">
              Enter your email and we'll send you a link to set a new password.
            </p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <button className="btn-primary w-full" disabled={busy}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="mt-4 text-sm text-slate-600">
              Remembered it? <Link to="/login" className="text-brand-600 hover:underline">Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
