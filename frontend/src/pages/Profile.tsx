import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Animal, type PointsMe, type User, type UserPet } from "../api";
import { useAuth } from "../auth";
import { ImageUpload } from "../components/ImageUpload";
import { formatDate, formatTimeAgo } from "../lib/format";

export function Profile() {
  const { user, refresh } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pts, setPts] = useState<PointsMe | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void api.get<PointsMe>("/points/me").then(setPts).catch(() => setPts(null));
  }, []);

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

  const referralUrl = pts?.referral_code
    ? `${window.location.origin}/register?ref=${pts.referral_code}`
    : null;

  async function copyRef() {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      {pts && (
        <section className="card overflow-hidden">
          <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-100/80">Your rank</p>
                <p className="mt-1 font-display text-3xl font-bold">Level {pts.level}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-100/80">Points</p>
                <p className="mt-1 font-display text-3xl font-bold">{pts.points.toLocaleString()}</p>
              </div>
            </div>
            {pts.next_floor != null && (
              <div className="mt-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full bg-white transition-all"
                    style={{ width: `${Math.round(pts.progress * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-brand-100/90">
                  {(pts.next_floor - pts.points).toLocaleString()} more points to level {pts.level + 1}
                </p>
              </div>
            )}
          </div>

          {referralUrl && (
            <div className="border-t border-slate-100 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invite friends</p>
              <p className="mt-1 text-sm text-slate-700">
                Your code: <span className="font-mono font-semibold text-brand-700">{pts.referral_code}</span>
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input readOnly value={referralUrl} className="input flex-1 font-mono text-xs" />
                <button onClick={copyRef} className="btn-primary text-sm">
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="card p-6">
        <h1 className="text-2xl font-bold">Your profile</h1>
        <p className="text-sm text-slate-500">{user.email}</p>
        <p className="mt-2 text-sm">
          {user.is_paid ? (
            <span className="chip-sage">Member · renews {user.paid_until ? formatDate(user.paid_until) : "—"}</span>
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

      {pts && pts.events.length > 0 && (
        <div className="card p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Points history</h2>
          <ul className="divide-y divide-slate-100">
            {pts.events.slice(0, 30).map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium capitalize">{e.kind.replaceAll("_", " ")}</p>
                  {e.note && <p className="truncate text-xs text-slate-500">{e.note}</p>}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-brand-600">+{e.points}</p>
                  <p className="text-xs text-slate-400">{formatTimeAgo(e.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MyPets />

      <ChangePasswordForm />

      <div className="card p-6">
        <h2 className="font-bold">Links</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li><Link to={`/u/${user.id}`} className="text-brand-600 hover:underline">View my public profile</Link></li>
          <li><Link to="/orders" className="text-brand-600 hover:underline">Your orders</Link></li>
          {user.is_paid && <li><Link to="/listings/new" className="text-brand-600 hover:underline">Post a pet listing</Link></li>}
          {user.is_admin && <li><Link to="/admin" className="text-brand-600 hover:underline">Admin panel</Link></li>}
        </ul>
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      setCurrent("");
      setNext("");
      setMessage({ kind: "ok", text: "Password updated." });
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Change failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-6">
      <h2 className="font-display text-lg font-semibold">Change password</h2>
      <div>
        <label className="label">Current password</label>
        <input className="input" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
      </div>
      <div>
        <label className="label">New password</label>
        <input className="input" type="password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary text-sm" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
        {message && (
          <span className={`text-sm ${message.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}

function MyPets() {
  const [pets, setPets] = useState<UserPet[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [draft, setDraft] = useState<Partial<UserPet> | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setPets(await api.get<UserPet[]>("/users/me/pets"));
  }
  useEffect(() => {
    void reload();
    void api.get<Animal[]>("/animals").then(setAnimals);
  }, []);

  async function save() {
    if (!draft?.name?.trim()) return;
    setBusy(true);
    try {
      const body = {
        name: draft.name,
        animal_id: draft.animal_id ?? null,
        photo_url: draft.photo_url ?? null,
        bio: draft.bio ?? null,
        birth_date: draft.birth_date ?? null,
      };
      if (draft.id) {
        await api.patch(`/users/me/pets/${draft.id}`, body);
      } else {
        await api.post("/users/me/pets", body);
      }
      setDraft(null);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Remove this pet?")) return;
    await api.del(`/users/me/pets/${id}`);
    await reload();
  }

  return (
    <section className="card space-y-3 p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">My pets</h2>
        {!draft && (
          <button
            onClick={() => setDraft({ name: "", animal_id: null, photo_url: null, bio: "", birth_date: null })}
            className="btn-primary text-sm"
          >
            + Add a pet
          </button>
        )}
      </div>

      {draft && (
        <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Pet name</label>
              <input className="input" required value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Species</label>
              <select
                className="input"
                value={draft.animal_id ?? ""}
                onChange={(e) => setDraft({ ...draft, animal_id: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">— select species —</option>
                {animals.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <ImageUpload
            value={draft.photo_url ?? null}
            onChange={(url) => setDraft({ ...draft, photo_url: url })}
            label="Pet photo"
          />
          <div>
            <label className="label">Bio / about</label>
            <textarea
              className="input min-h-[80px]"
              value={draft.bio ?? ""}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              placeholder="Breed, quirks, favorite treat…"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy || !draft.name?.trim()} className="btn-primary text-sm">
              {busy ? "Saving…" : draft.id ? "Update pet" : "Add pet"}
            </button>
            <button onClick={() => setDraft(null)} className="btn-secondary text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {pets.length === 0 && !draft ? (
        <p className="text-sm text-slate-500">Add a pet to show it on your public profile.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {pets.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex gap-3">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} className="h-16 w-16 rounded-md object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-md bg-cream-100 text-2xl">🐾</div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  {p.animal_name && <p className="text-xs text-slate-500">{p.animal_name}</p>}
                </div>
              </div>
              {p.bio && <p className="mt-2 line-clamp-2 text-xs text-slate-600">{p.bio}</p>}
              <div className="mt-2 flex gap-2 text-xs">
                <button onClick={() => setDraft(p)} className="text-brand-600 hover:underline">
                  Edit
                </button>
                <button onClick={() => remove(p.id)} className="text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
