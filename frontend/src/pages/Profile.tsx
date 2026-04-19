import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type User } from "../api";
import { useAuth } from "../auth";
import { ImageUpload } from "../components/ImageUpload";
import { formatDate } from "../lib/format";

export function Profile() {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  if (!user) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch<User>("/auth/me", { display_name: displayName, bio, avatar_url: avatarUrl });
      await refresh();
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="card p-6">
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="text-sm text-slate-500">{user.email}</p>
        <p className="mt-2 text-sm">
          {user.is_paid ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
              Member · renews {user.paid_until ? formatDate(user.paid_until) : "—"}
            </span>
          ) : (
            <Link to="/subscribe" className="text-brand-600 underline">
              Upgrade to full membership
            </Link>
          )}
        </p>

        <form onSubmit={save} className="mt-6 space-y-4">
          <div>
            <label className="label">Display name</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="label">Bio</label>
            <textarea className="input min-h-[100px]" value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <ImageUpload value={avatarUrl} onChange={setAvatarUrl} label="Avatar" />
          <div className="flex items-center gap-3">
            <button className="btn-primary" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            {savedAt && <p className="text-sm text-emerald-600">Saved at {savedAt}</p>}
          </div>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="font-bold">Links</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li><Link to="/orders" className="text-brand-600 hover:underline">Your orders</Link></li>
          {user.is_paid && <li><Link to="/listings/new" className="text-brand-600 hover:underline">Post a pet listing</Link></li>}
          {user.is_admin && <li><Link to="/admin" className="text-brand-600 hover:underline">Admin panel</Link></li>}
        </ul>
      </div>
    </div>
  );
}
