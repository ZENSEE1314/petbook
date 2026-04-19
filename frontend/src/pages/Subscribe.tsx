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
    <div className="mx-auto max-w-xl p-4 sm:p-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 p-6 text-center text-white shadow-elev-3 sm:p-8">
        <p className="eyebrow !text-brand-100">Petbook membership</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Be the owner every pet deserves.
        </h1>
        <p className="mt-2 text-brand-50/90">Full care knowledge + marketplace access.</p>

        <p className="my-6">
          <span className="font-display text-6xl font-bold">$10</span>
          <span className="ml-1 align-top text-lg font-semibold text-brand-100">/year</span>
        </p>

        <ul className="mx-auto mb-6 max-w-sm space-y-2 text-left text-sm">
          <Perk>Unlock detailed care guides for every species</Perk>
          <Perk>Post pet listings to rehome or sell</Perk>
          <Perk>Ad-free feed (coming soon)</Perk>
          <Perk>Priority admin support</Perk>
        </ul>

        {user.is_paid ? (
          <div className="rounded-2xl bg-white/15 p-4 text-left text-sm backdrop-blur">
            <p>
              <strong>You're a member.</strong>
              <br />
              Renews on <strong>{user.paid_until ? formatDate(user.paid_until) : "—"}</strong>.
            </p>
            <button onClick={subscribe} disabled={busy} className="mt-3 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-cream-50">
              Extend another year
            </button>
          </div>
        ) : (
          <>
            <button onClick={subscribe} disabled={busy} className="w-full rounded-lg bg-white py-3 text-base font-bold text-brand-700 shadow-elev-2 hover:bg-cream-50 disabled:bg-brand-100 disabled:text-brand-400">
              {busy ? "Processing…" : "Upgrade now"}
            </button>
            {error && <p className="mt-2 text-sm text-red-100">{error}</p>}
          </>
        )}

        <p className="mt-4 text-xs text-brand-100/90">
          Shop and feed are free for everyone. Membership gates the full care guide and pet listings.
        </p>
      </div>
    </div>
  );
}

function Perk({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs">✓</span>
      <span>{children}</span>
    </li>
  );
}
