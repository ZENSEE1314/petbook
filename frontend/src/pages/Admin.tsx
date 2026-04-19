import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import {
  api,
  type Animal,
  type GuideEntry,
  type GuideMedia,
  type Order,
  type PointsConfig,
  type Product,
  type SiteSettings,
  type User,
} from "../api";
import { ImageUpload } from "../components/ImageUpload";
import { MediaUpload } from "../components/MediaUpload";
import { formatDate, formatPrice, formatTimeAgo } from "../lib/format";
import { useSite } from "../site";

export function Admin() {
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-md px-3 py-2 text-sm ${
      isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-3xl font-bold">Admin</h1>
      <nav className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pb-2 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <NavLink end to="/admin" className={tabClass}>Users</NavLink>
        <NavLink to="/admin/animals" className={tabClass}>Animals & Guides</NavLink>
        <NavLink to="/admin/products" className={tabClass}>Products</NavLink>
        <NavLink to="/admin/orders" className={tabClass}>Orders</NavLink>
        <NavLink to="/admin/settings" className={tabClass}>Site settings</NavLink>
        <NavLink to="/admin/points" className={tabClass}>Points & levels</NavLink>
      </nav>
      <Routes>
        <Route index element={<Users />} />
        <Route path="animals" element={<Animals />} />
        <Route path="products" element={<Products />} />
        <Route path="orders" element={<Orders />} />
        <Route path="settings" element={<SiteSettingsForm />} />
        <Route path="points" element={<PointsConfigForm />} />
      </Routes>
    </div>
  );
}

// ---------- Users ----------

function Users() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    void api.get<User[]>("/admin/users").then(setUsers);
  }, []);

  async function patch(id: number, body: Partial<Pick<User, "is_active" | "is_admin" | "is_paid">>) {
    const updated = await api.patch<User>(`/admin/users/${id}`, body);
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
  }

  async function remove(id: number) {
    if (!confirm("Delete this user? This cannot be undone.")) return;
    await api.del(`/admin/users/${id}`);
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">User</th>
            <th className="px-4 py-2">Joined</th>
            <th className="px-4 py-2">Active</th>
            <th className="px-4 py-2">Paid</th>
            <th className="px-4 py-2">Admin</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-slate-100">
              <td className="px-4 py-2">
                <p className="font-medium">{u.display_name ?? "—"}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-slate-600">{formatDate(u.created_at)}</td>
              <td className="px-4 py-2">
                <Toggle value={u.is_active} onChange={(v) => patch(u.id, { is_active: v })} />
              </td>
              <td className="px-4 py-2">
                <Toggle value={u.is_paid} onChange={(v) => patch(u.id, { is_paid: v })} />
              </td>
              <td className="px-4 py-2">
                <Toggle value={u.is_admin} onChange={(v) => patch(u.id, { is_admin: v })} />
              </td>
              <td className="px-4 py-2 text-right">
                <button onClick={() => remove(u.id)} className="whitespace-nowrap text-xs text-red-600 hover:underline">
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={value}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 accent-brand-600"
    />
  );
}

// ---------- Animals ----------

function Animals() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [editing, setEditing] = useState<Animal | null>(null);
  const [editingGuide, setEditingGuide] = useState<Animal | null>(null);

  async function reload() {
    const list = await api.get<Animal[]>("/animals");
    setAnimals(list);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function suggestMore() {
    const count = Number(prompt("How many species should AI suggest?", "5"));
    if (!count) return;
    const resp = await api.post<{
      source: string;
      error: string | null;
      animals: { name: string; category: string; short_description: string }[];
    }>("/admin/animals/suggest", { count });
    for (const s of resp.animals) {
      try {
        await api.post("/animals", s);
      } catch {
        /* skip dupes */
      }
    }
    await reload();
    if (resp.source === "canned" && resp.error) {
      alert(`AI unavailable — added canned fallback species.\n\n${resp.error}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Animals ({animals.length})</h2>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={suggestMore}>
            Suggest via AI
          </button>
          <button className="btn-primary" onClick={() => setEditing({ id: 0, slug: "", name: "", category: "", short_description: "", image_url: null, has_guide: false })}>
            New animal
          </button>
        </div>
      </div>

      {editing && (
        <AnimalForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}

      {editingGuide && (
        <GuideEditor
          animal={editingGuide}
          onClose={() => setEditingGuide(null)}
          onSaved={async () => {
            await reload();
          }}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {animals.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{a.name}</p>
                <p className="text-xs text-slate-500">{a.category ?? "—"}</p>
              </div>
              {a.has_guide ? (
                <span className="chip-sage shrink-0">Published</span>
              ) : (
                <span className="chip-slate shrink-0">Draft</span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.short_description ?? "—"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setEditing(a)} className="btn-secondary text-xs">
                Edit
              </button>
              <button onClick={() => setEditingGuide(a)} className="btn-secondary text-xs">
                Edit guide
              </button>
              <PublishToggle animal={a} onChanged={reload} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PublishToggle({ animal, onChanged }: { animal: Animal; onChanged: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      // 1. Make sure a guide row exists, then read it.
      let guide: GuideEntry;
      try {
        guide = await api.get<GuideEntry>(`/animals/${animal.slug}/guide`);
      } catch {
        guide = await api.put<GuideEntry>(`/animals/${animal.id}/guide`, { is_published: false });
      }
      // 2. Flip is_published, keep all the other fields intact.
      const { id, animal_id, updated_at, ...editable } = guide;
      void id;
      void animal_id;
      void updated_at;
      await api.put<GuideEntry>(`/animals/${animal.id}/guide`, {
        ...editable,
        is_published: !guide.is_published,
      });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`text-xs ${
        animal.has_guide
          ? "rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
          : "rounded-md bg-brand-600 px-2 py-1 font-semibold text-white hover:bg-brand-700"
      } disabled:opacity-60`}
    >
      {busy ? "…" : animal.has_guide ? "Unpublish" : "Publish"}
    </button>
  );
}

function AnimalForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Animal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [category, setCategory] = useState(initial.category ?? "");
  const [description, setDescription] = useState(initial.short_description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initial.image_url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        name,
        slug: slug || undefined,
        category: category || null,
        short_description: description || null,
        image_url: imageUrl,
      };
      if (initial.id === 0) {
        await api.post("/animals", body);
      } else {
        await api.patch(`/animals/${initial.id}`, body);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-3 p-4">
      <h3 className="font-bold">{initial.id === 0 ? "New animal" : `Edit ${initial.name}`}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Slug (URL)</label>
          <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto" />
        </div>
        <div>
          <label className="label">Category</label>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="mammal, bird, reptile…" />
        </div>
      </div>
      <div>
        <label className="label">Short description</label>
        <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <ImageUpload value={imageUrl} onChange={setImageUrl} />
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

function GuideEditor({
  animal,
  onClose,
  onSaved,
}: {
  animal: Animal;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [guide, setGuide] = useState<GuideEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMessage(null);
    setGuide(null);
    void (async () => {
      try {
        const g = await api.get<GuideEntry>(`/animals/${animal.slug}/guide`);
        if (!cancelled) setGuide(g);
      } catch {
        if (cancelled) return;
        setGuide({
          id: 0,
          animal_id: animal.id,
          story: "",
          origin: "",
          temperament: "",
          colors: "",
          lifespan_years: "",
          weight_range: "",
          length_range: "",
          adult_size: "",
          healthy_markers: "",
          diet: "",
          training: "",
          housing: "",
          common_issues: "",
          age_stages: "",
          sexing: "",
          breeding_guide: "",
          breeding_frequency: "",
          litter_size: "",
          recommended_product_ids: "",
          is_published: false,
          updated_at: new Date().toISOString(),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [animal.id, animal.slug]);

  async function generateDraft() {
    setBusy(true);
    setMessage(null);
    try {
      const resp = await api.post<GuideEntry & { _ai?: { source: string; error: string | null } }>(
        `/admin/animals/${animal.id}/generate-guide`,
      );
      const { _ai, ...g } = resp;
      setGuide(g as GuideEntry);
      if (_ai?.source === "canned") {
        setMessage({
          kind: "err",
          text: `AI unavailable — using placeholders. ${_ai.error ?? "Check OLLAMA_API_KEY / model name."}`,
        });
      } else {
        setMessage({
          kind: "ok",
          text: `Draft loaded via ${_ai?.source ?? "AI"} — review each field then Save guide.`,
        });
      }
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Draft failed" });
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!guide) return;
    setBusy(true);
    setMessage(null);
    try {
      // The response echoes readonly fields like id/updated_at — strip them so the
      // PUT body matches GuideEntryIn exactly.
      const { id, animal_id, updated_at, ...editable } = guide;
      void id;
      void animal_id;
      void updated_at;
      const g = await api.put<GuideEntry>(`/animals/${animal.id}/guide`, editable);
      setGuide(g);
      setMessage({ kind: "ok", text: "Saved." });
      onSaved();
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  const fields: Array<[keyof GuideEntry, string]> = [
    ["story", "Story (history, character, what makes them special)"],
    ["origin", "Origin (native region / breed origin)"],
    ["temperament", "Temperament & personality"],
    ["colors", "Colour variations"],
    ["lifespan_years", "Lifespan (years, e.g. 10-15)"],
    ["weight_range", "Weight range (e.g. 2-4 kg)"],
    ["length_range", "Length / height range (e.g. 30-40 cm)"],
    ["adult_size", "Adult size summary"],
    ["diet", "Diet & feeding schedule"],
    ["training", "Training approach"],
    ["housing", "Housing / enclosure / environment"],
    ["healthy_markers", "Signs of good health"],
    ["common_issues", "Common issues & prevention"],
    ["age_stages", "Birth-to-adult lifecycle (JSON — stage, age_range, size, feeding, milestones, notes)"],
    ["sexing", "How to tell male vs female"],
    ["breeding_guide", "Breeding guide (pairing, environment, gestation, weaning)"],
    ["breeding_frequency", "Breeding frequency (e.g. '1-2 times per year')"],
    ["litter_size", "Litter / clutch size (e.g. '4-6 kits', '100-200 eggs')"],
  ];

  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{animal.name} — guide</h3>
        <div className="flex gap-2">
          <button onClick={generateDraft} disabled={busy || !guide} className="btn-secondary text-xs">
            {busy ? "Generating…" : "Draft via AI"}
          </button>
          <button onClick={onClose} className="btn-secondary text-xs">
            Close
          </button>
        </div>
      </div>

      {!guide ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([key, label]) => {
              const isLong = [
                "story", "diet", "training", "housing", "common_issues",
                "age_stages", "sexing", "breeding_guide",
              ].includes(key as string);
              const className = isLong ? "sm:col-span-2" : "";
              return (
                <div key={key as string} className={className}>
                  <label className="label">{label}</label>
                  <textarea
                    className="input min-h-[70px]"
                    value={(guide[key] as string | null) ?? ""}
                    onChange={(e) => setGuide({ ...guide, [key]: e.target.value })}
                  />
                </div>
              );
            })}
          </div>

          <MediaManager animal={animal} />

          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-brand-600"
              checked={guide.is_published}
              onChange={(e) => setGuide({ ...guide, is_published: e.target.checked })}
            />
            <span>
              <span className="font-semibold text-slate-900">Publish this guide</span>
              <span className="block text-xs text-slate-500">
                When on, paid members see the full guide. When off, the guide is hidden and the
                Pet Guide index shows "Coming soon".
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={save} disabled={busy} className="btn-primary">
              {busy ? "Saving…" : "Save guide"}
            </button>
            <button onClick={onClose} type="button" className="btn-secondary">
              Cancel
            </button>
            {message && (
              <span
                className={`text-sm ${
                  message.kind === "ok" ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {message.text}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Media manager (inside GuideEditor) ----------

function MediaManager({ animal }: { animal: Animal }) {
  const [items, setItems] = useState<GuideMedia[]>([]);
  const [pending, setPending] = useState<{ url: string; kind: GuideMedia["kind"] } | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCaption, setEditCaption] = useState("");

  async function reload() {
    setItems(await api.get<GuideMedia[]>(`/animals/${animal.slug}/media`));
  }
  useEffect(() => {
    void reload();
  }, [animal.slug]);

  async function attach() {
    if (!pending) return;
    if (!title.trim()) {
      alert("Please enter a title so owners know what this tutorial is about.");
      return;
    }
    setBusy(true);
    try {
      await api.post<GuideMedia>(`/animals/${animal.id}/media`, {
        kind: pending.kind,
        url: pending.url,
        title: title.trim(),
        caption: caption.trim() || null,
        position: items.length,
      });
      setPending(null);
      setTitle("");
      setCaption("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(m: GuideMedia) {
    if (!editTitle.trim()) {
      alert("Title can't be empty.");
      return;
    }
    await api.patch<GuideMedia>(`/animals/media/${m.id}`, {
      kind: m.kind,
      url: m.url,
      title: editTitle.trim(),
      caption: editCaption.trim() || null,
      poster_url: m.poster_url,
      position: m.position,
    });
    setEditingId(null);
    await reload();
  }

  async function move(m: GuideMedia, direction: -1 | 1) {
    const idx = items.findIndex((x) => x.id === m.id);
    const swap = items[idx + direction];
    if (!swap) return;
    await Promise.all([
      api.patch(`/animals/media/${m.id}`, { kind: m.kind, url: m.url, title: m.title, caption: m.caption, poster_url: m.poster_url, position: swap.position }),
      api.patch(`/animals/media/${swap.id}`, { kind: swap.kind, url: swap.url, title: swap.title, caption: swap.caption, poster_url: swap.poster_url, position: m.position }),
    ]);
    await reload();
  }

  async function remove(id: number) {
    if (!confirm("Delete this media?")) return;
    await api.del(`/animals/media/${id}`);
    await reload();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-lg font-semibold">Training videos & audio</h4>
        <span className="chip-slate">{items.length} attached</span>
      </div>
      <p className="mb-3 text-xs text-slate-600">
        Upload one file at a time. Each tutorial needs a title (what's being taught) and an
        optional description.
      </p>

      {items.length > 0 && (
        <ul className="mb-4 grid gap-3 sm:grid-cols-2">
          {items.map((m, idx) => {
            const isEditing = editingId === m.id;
            return (
              <li key={m.id} className="rounded-lg border border-slate-200 bg-white p-3">
                {m.kind === "video" ? (
                  <video src={m.url} controls preload="metadata" className="w-full rounded-md bg-black" />
                ) : m.kind === "audio" ? (
                  <audio src={m.url} controls preload="metadata" className="w-full" />
                ) : (
                  <img src={m.url} alt={m.title ?? ""} className="w-full rounded-md" />
                )}

                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" />
                    <textarea
                      className="input min-h-[60px]"
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      placeholder="What is this training about?"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(m)} className="btn-primary text-xs">Save</button>
                      <button onClick={() => setEditingId(null)} className="btn-secondary text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-semibold">{m.title ?? <span className="text-red-600">Untitled — add a title</span>}</p>
                    {m.caption && <p className="text-xs text-slate-600">{m.caption}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <button
                        onClick={() => {
                          setEditingId(m.id);
                          setEditTitle(m.title ?? "");
                          setEditCaption(m.caption ?? "");
                        }}
                        className="text-brand-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button onClick={() => move(m, -1)} disabled={idx === 0} className="text-slate-500 hover:text-slate-900 disabled:text-slate-300">
                        ↑ Up
                      </button>
                      <button onClick={() => move(m, 1)} disabled={idx === items.length - 1} className="text-slate-500 hover:text-slate-900 disabled:text-slate-300">
                        ↓ Down
                      </button>
                      <button onClick={() => remove(m.id)} className="ml-auto text-red-600 hover:underline">
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {pending ? (
        <div className="space-y-2 rounded-lg border border-brand-200 bg-brand-50 p-3">
          <p className="text-sm text-brand-700">
            ✅ {pending.kind} uploaded. Add details so owners know what it teaches.
          </p>
          <div>
            <label className="label">Title <span className="text-red-600">*</span></label>
            <input
              className="input"
              required
              placeholder="e.g. 'Teaching Sit and Stay', 'Nail clipping basics'"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="label">What is this training about?</label>
            <textarea
              className="input min-h-[70px]"
              placeholder="e.g. 'First 5 minutes — show reward placement, lure into sit, mark and treat. Works for puppies 3+ months.'"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={attach} disabled={busy || !title.trim()} className="btn-primary text-sm">
              {busy ? "Saving…" : "Attach to guide"}
            </button>
            <button onClick={() => setPending(null)} className="btn-secondary text-sm">
              Cancel & discard upload
            </button>
          </div>
        </div>
      ) : (
        <MediaUpload
          label={items.length === 0 ? "Add your first training video or audio" : "Add another tutorial"}
          onUploaded={(r) => setPending(r)}
        />
      )}
    </section>
  );
}


// ---------- Products ----------

function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);

  async function reload() {
    setProducts(await api.get<Product[]>("/products"));
  }

  useEffect(() => {
    void reload();
  }, []);

  async function remove(p: Product) {
    if (!confirm(`Delete ${p.name}?`)) return;
    await api.del(`/products/${p.id}`);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Products ({products.length})</h2>
        <button
          className="btn-primary"
          onClick={() =>
            setEditing({
              id: 0,
              slug: "",
              name: "",
              category: "food",
              description: "",
              price_cents: 0,
              stock: 0,
              image_url: null,
              suitable_for: "[]",
              ship_local_cents: 0,
              ship_overseas_cents: 0,
              is_active: true,
            })
          }
        >
          New product
        </button>
      </div>

      {editing && (
        <ProductForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Price</th>
              <th className="px-4 py-2">Stock</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="px-4 py-2">{p.name}</td>
                <td className="whitespace-nowrap px-4 py-2 text-center">{p.category}</td>
                <td className="whitespace-nowrap px-4 py-2 text-center">{formatPrice(p.price_cents)}</td>
                <td className="px-4 py-2 text-center">{p.stock}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <button className="text-xs text-brand-600 hover:underline" onClick={() => setEditing(p)}>
                    Edit
                  </button>
                  <button className="ml-3 text-xs text-red-600 hover:underline" onClick={() => remove(p)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState(initial);
  const [priceDollars, setPriceDollars] = useState((initial.price_cents / 100).toFixed(2));
  const [busy, setBusy] = useState(false);

  function bind<K extends keyof Product>(key: K, value: Product[K]) {
    setData({ ...data, [key]: value });
  }

  const [shipLocalDollars, setShipLocalDollars] = useState(
    (initial.ship_local_cents / 100).toFixed(2),
  );
  const [shipOverseasDollars, setShipOverseasDollars] = useState(
    (initial.ship_overseas_cents / 100).toFixed(2),
  );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...data,
        price_cents: Math.round(Number(priceDollars) * 100),
        ship_local_cents: Math.round(Number(shipLocalDollars) * 100),
        ship_overseas_cents: Math.round(Number(shipOverseasDollars) * 100),
      };
      if (initial.id === 0) {
        await api.post("/products", body);
      } else {
        await api.patch(`/products/${initial.id}`, body);
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="card space-y-3 p-4">
      <h3 className="font-bold">{initial.id === 0 ? "New product" : `Edit ${initial.name}`}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input" required value={data.name} onChange={(e) => bind("name", e.target.value)} />
        </div>
        <div>
          <label className="label">Slug</label>
          <input className="input" value={data.slug} onChange={(e) => bind("slug", e.target.value)} placeholder="auto" />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={data.category ?? ""} onChange={(e) => bind("category", e.target.value)}>
            <option value="food">food</option>
            <option value="toy">toy</option>
            <option value="cage">cage</option>
            <option value="accessory">accessory</option>
            <option value="health">health</option>
          </select>
        </div>
        <div>
          <label className="label">Price (USD)</label>
          <input className="input" type="number" step="0.01" min={0} value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} />
        </div>
        <div>
          <label className="label">Stock</label>
          <input className="input" type="number" min={0} value={data.stock} onChange={(e) => bind("stock", Number(e.target.value))} />
        </div>
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input min-h-[80px]" value={data.description ?? ""} onChange={(e) => bind("description", e.target.value)} />
      </div>
      <div>
        <label className="label">Suitable for (JSON array of animal slugs, e.g. ["cat","dog"])</label>
        <input className="input" value={data.suitable_for ?? ""} onChange={(e) => bind("suitable_for", e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Local shipping fee (USD)</label>
          <input className="input" type="number" step="0.01" min={0} value={shipLocalDollars} onChange={(e) => setShipLocalDollars(e.target.value)} />
        </div>
        <div>
          <label className="label">Overseas shipping fee (USD)</label>
          <input className="input" type="number" step="0.01" min={0} value={shipOverseasDollars} onChange={(e) => setShipOverseasDollars(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Order shipping is the highest per-product fee in the cart, not summed — one shipping charge per order.
      </p>
      <ImageUpload value={data.image_url} onChange={(url) => bind("image_url", url)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={data.is_active} onChange={(e) => bind("is_active", e.target.checked)} />
        Active (visible in shop)
      </label>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------- Orders ----------

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  paid: "bg-emerald-100 text-emerald-700",
  ready_to_ship: "bg-amber-100 text-amber-700",
  shipped: "bg-sky-100 text-sky-700",
  delivered: "bg-indigo-100 text-indigo-700",
  cancelled: "bg-rose-100 text-rose-700",
};

const NEXT_STATUS: Record<string, { label: string; next: string } | null> = {
  pending: { label: "Mark paid", next: "paid" },
  paid: { label: "Mark ready to ship", next: "ready_to_ship" },
  ready_to_ship: { label: "Mark shipped", next: "shipped" },
  shipped: { label: "Mark delivered", next: "delivered" },
  delivered: null,
  cancelled: null,
};

function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function reload() {
    setOrders(await api.get<Order[]>("/admin/orders"));
  }

  useEffect(() => {
    void reload();
  }, []);

  async function advance(order: Order) {
    const action = NEXT_STATUS[order.status];
    if (!action) return;
    setBusy(order.id);
    try {
      const updated = await api.patch<Order>(
        `/orders/${order.id}/status?new_status=${action.next}`,
      );
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } finally {
      setBusy(null);
    }
  }

  async function cancel(order: Order) {
    if (!confirm(`Cancel order #${order.id}?`)) return;
    const updated = await api.patch<Order>(`/orders/${order.id}/status?new_status=cancelled`);
    setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
  }

  const filtered = filter ? orders.filter((o) => o.status === filter) : orders;
  const counts: Record<string, number> = {};
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <h2 className="text-xl font-bold">Orders ({orders.length})</h2>
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:ml-auto sm:flex-wrap sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip active={filter === ""} label={`All · ${orders.length}`} onClick={() => setFilter("")} />
          {["pending", "paid", "ready_to_ship", "shipped", "delivered", "cancelled"].map((s) => (
            <FilterChip
              key={s}
              active={filter === s}
              label={`${s.replaceAll("_", " ")} · ${counts[s] ?? 0}`}
              onClick={() => setFilter(s)}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-slate-500">No orders match.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((o) => {
            const action = NEXT_STATUS[o.status];
            const isOpen = expanded === o.id;
            return (
              <li key={o.id} className="card overflow-hidden">
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => setExpanded(isOpen ? null : o.id)} className="shrink-0 text-left">
                      <span className="font-semibold text-brand-600">#{o.id}</span>
                      <p className="text-xs text-slate-500">{formatTimeAgo(o.created_at)}</p>
                    </button>
                    <span className={`chip capitalize ${STATUS_COLORS[o.status] ?? "bg-slate-100 text-slate-700"}`}>
                      {o.status.replaceAll("_", " ")}
                    </span>
                    <p className="ml-auto whitespace-nowrap font-semibold">{formatPrice(o.total_cents)}</p>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Buyer</p>
                      <p className="truncate font-medium">{o.buyer_display_name ?? "—"}</p>
                      <p className="truncate text-xs text-slate-500">{o.buyer_email}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Ship to</p>
                      <p className="truncate">{o.shipping_name ?? "—"}</p>
                      <p className="truncate text-xs text-slate-400">{o.shipping_address}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {action ? (
                      <button
                        onClick={() => advance(o)}
                        disabled={busy === o.id}
                        className="btn-primary whitespace-nowrap text-xs"
                      >
                        {busy === o.id ? "…" : action.label}
                      </button>
                    ) : null}
                    {o.status !== "delivered" && o.status !== "cancelled" && (
                      <button onClick={() => cancel(o)} className="btn-secondary whitespace-nowrap text-xs text-red-600">
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4 text-sm">
                    <div className="grid gap-4 md:grid-cols-2">
                      <section>
                        <h4 className="mb-1 font-semibold">Items</h4>
                        <ul className="divide-y divide-slate-200">
                          {o.items.map((it) => (
                            <li key={it.id} className="flex justify-between py-1">
                              <span>{it.product_name} × {it.quantity}</span>
                              <span className="text-slate-700">{formatPrice(it.unit_price_cents * it.quantity)}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                      <section>
                        <h4 className="mb-1 font-semibold">Shipping</h4>
                        <p>{o.shipping_name}</p>
                        <p className="whitespace-pre-wrap text-slate-700">{o.shipping_address}</p>
                        {o.shipping_phone && <p>Tel: {o.shipping_phone}</p>}
                        <p className="mt-2 text-xs text-slate-500">Placed {formatDate(o.created_at)}</p>
                      </section>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium capitalize ${
        active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

// ---------- Points & levels ----------

function PointsConfigForm() {
  const [data, setData] = useState<PointsConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    void api.get<PointsConfig>("/points/config").then(setData);
  }, []);

  if (!data) return <p className="p-6 text-slate-500">Loading…</p>;

  function bind<K extends keyof PointsConfig>(key: K, value: PointsConfig[K]) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!data) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await api.patch<PointsConfig>("/points/config", data);
      setData(saved);
      setMessage({ kind: "ok", text: "Saved. New awards apply going forward." });
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  const fields: Array<[keyof PointsConfig, string, string]> = [
    ["post_created", "Post created", "When a user posts to the feed"],
    ["post_liked", "Post liked", "Awarded to the post author when someone likes it"],
    ["comment_created", "Comment created", "When a user comments on a post"],
    ["listing_created", "Listing created", "When a paid member posts a pet listing"],
    ["listing_sold", "Listing sold", "When a seller marks their listing as sold"],
    ["order_per_dollar", "Order — per $1 spent", "Points per US dollar of a paid order"],
    ["referral_signup", "Referral signup (referrer)", "Awarded when someone joins with your referral code"],
    ["referral_joiner_bonus", "Referral signup (new user)", "Welcome bonus for using a referral code"],
    ["review_created", "Review created", "When a user posts a guide review"],
    ["answer_created", "Answer created", "When a user answers a forum question"],
    ["answer_accepted", "Answer accepted", "When the asker marks their answer as the accepted one"],
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Points & levels</h2>
        <p className="text-sm text-slate-600">
          Tune how many points users earn for each action. Changes apply to new events
          immediately — historical events keep the amount they were awarded.
        </p>
      </div>

      <section className="card p-4 sm:p-6">
        <h3 className="mb-4 font-display text-lg font-semibold">Points per action</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map(([key, label, help]) => (
            <div key={key as string}>
              <label className="label">{label}</label>
              <input
                type="number"
                min={0}
                className="input"
                value={(data as any)[key] as number}
                onChange={(e) => bind(key, Number(e.target.value) as any)}
              />
              <p className="mt-1 text-xs text-slate-500">{help}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4 sm:p-6">
        <h3 className="mb-2 font-display text-lg font-semibold">Level thresholds</h3>
        <p className="mb-3 text-sm text-slate-600">
          JSON array of cumulative points required to reach each level. Example:{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">[0,50,200,500,1500,5000,15000]</code>
          {" "}means Level 1 starts at 0, Level 2 at 50 pts, Level 7 at 15k.
        </p>
        <textarea
          className="input min-h-[80px] font-mono text-sm"
          value={data.level_thresholds}
          onChange={(e) => bind("level_thresholds", e.target.value)}
        />
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save config"}
        </button>
        {message && (
          <span className={`text-sm ${message.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- Site settings ----------

function SiteSettingsForm() {
  const { refresh } = useSite();
  const [data, setData] = useState<SiteSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    void api.get<SiteSettings>("/site/settings").then(setData);
  }, []);

  if (!data) return <p className="p-6 text-slate-500">Loading…</p>;

  function bind<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setData((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!data) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await api.patch<SiteSettings>("/site/settings", data);
      setData(saved);
      await refresh();
      setMessage({ kind: "ok", text: "Saved. Changes are live across the site." });
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Site settings</h2>
      <p className="text-sm text-slate-600">
        Branding and SEO metadata. Changes take effect immediately on every page.
      </p>

      <section className="card space-y-4 p-4 sm:p-6">
        <h3 className="font-display text-lg font-semibold">Brand</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Site name</label>
            <input className="input" value={data.site_name} onChange={(e) => bind("site_name", e.target.value)} />
          </div>
          <div>
            <label className="label">Theme colour (hex)</label>
            <input className="input" value={data.theme_color} onChange={(e) => bind("theme_color", e.target.value)} placeholder="#f97316" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Tagline</label>
            <input
              className="input"
              value={data.tagline ?? ""}
              onChange={(e) => bind("tagline", e.target.value || null)}
              placeholder="social, guide & shop for pet owners"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <ImageUpload
              label="Logo (square image, shown in nav + social cards)"
              value={data.logo_url}
              onChange={(url) => bind("logo_url", url)}
            />
          </div>
          <div>
            <ImageUpload
              label="Favicon (tab icon — .png or .svg, 32×32 ideal)"
              value={data.favicon_url}
              onChange={(url) => bind("favicon_url", url)}
            />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-4 sm:p-6">
        <h3 className="font-display text-lg font-semibold">SEO / meta tags</h3>
        <div>
          <label className="label">Meta title (browser tab + Google)</label>
          <input
            className="input"
            value={data.meta_title ?? ""}
            onChange={(e) => bind("meta_title", e.target.value || null)}
            placeholder={`${data.site_name} — social, guide & shop for pet owners`}
          />
          <p className="mt-1 text-xs text-slate-500">Leave blank to auto-generate from site name.</p>
        </div>
        <div>
          <label className="label">Meta description (shown in search results)</label>
          <textarea
            className="input min-h-[80px]"
            value={data.meta_description ?? ""}
            onChange={(e) => bind("meta_description", e.target.value || null)}
            placeholder="A pet community, science-backed care guides, and a trusted shop."
            maxLength={400}
          />
          <p className="mt-1 text-xs text-slate-500">~160 chars is ideal for Google.</p>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? "Saving…" : "Save settings"}
        </button>
        {message && (
          <span className={`text-sm ${message.kind === "ok" ? "text-emerald-600" : "text-red-600"}`}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
