import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatDate } from "../lib/format";

export function Subscribe() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ checkout_url: string | null; provider: string }>(
        "/subscription/subscribe",
      );
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        await refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <h1 className="text-2xl font-bold">Membership</h1>
        <p className="mt-2 text-slate-600">
          Create a free account first, then upgrade for <strong>$10/year</strong>.
        </p>
        <div className="mt-4 space-x-2">
          <Link to="/register" className="btn-primary">
            Join free
          </Link>
          <Link to="/login" className="btn-secondary">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="card p-8 text-center">
        <h1 className="text-3xl font-bold">Petbook Membership</h1>
        <p className="mt-2 text-slate-600">Everything you need to be a great owner.</p>

        <p className="my-6 text-5xl font-black text-brand-600">$10<span className="text-xl font-semibold text-slate-500">/year</span></p>

        <ul className="mx-auto mb-6 max-w-sm space-y-2 text-left text-sm text-slate-700">
          <li>✅ Unlock full care guides for every species</li>
          <li>✅ Post pet listings (buy / sell / rehome)</li>
          <li>✅ Ad-free feed (coming soon)</li>
          <li>✅ Priority admin support</li>
        </ul>

        {user.is_paid ? (
          <div className="rounded-md bg-emerald-50 p-4 text-emerald-700">
            You're a member! Renews on <strong>{user.paid_until ? formatDate(user.paid_until) : "—"}</strong>.
            <button onClick={subscribe} disabled={busy} className="btn-secondary mt-3 text-sm">
              Extend another year
            </button>
          </div>
        ) : (
          <>
            <button onClick={subscribe} disabled={busy} className="btn-primary w-full">
              {busy ? "Processing…" : "Upgrade now"}
            </button>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </>
        )}

        <p className="mt-4 text-xs text-slate-500">
          Shop is open to everyone. Social feed is open to everyone with an account. The paid plan
          only gates the full care guide + ability to list pets.
        </p>
      </div>
    </div>
  );
}
