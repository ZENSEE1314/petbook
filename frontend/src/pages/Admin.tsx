import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api, type Animal, type GuideEntry, type Product, type User } from "../api";
import { ImageUpload } from "../components/ImageUpload";
import { formatDate, formatPrice } from "../lib/format";

export function Admin() {
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-sm rounded-md ${
      isActive ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-3xl font-bold">Admin</h1>
      <nav className="mb-4 flex gap-1 border-b border-slate-200 pb-2">
        <NavLink end to="/admin" className={tabClass}>Users</NavLink>
        <NavLink to="/admin/animals" className={tabClass}>Animals & Guides</NavLink>
        <NavLink to="/admin/products" className={tabClass}>Products</NavLink>
      </nav>
      <Routes>
        <Route index element={<Users />} />
        <Route path="animals" element={<Animals />} />
        <Route path="products" element={<Products />} />
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
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
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
              <td className="px-4 py-2 text-slate-600">{formatDate(u.created_at)}</td>
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
                <button onClick={() => remove(u.id)} className="text-xs text-red-600 hover:underline">
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

  async function reload() {
    const list = await api.get<Animal[]>("/animals");
    setAnimals(list);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function suggestMore() {
    const count = Number(prompt("How many species should Claude suggest?", "5"));
    if (!count) return;
    const suggestions = await api.post<{ name: string; category: string; short_description: string }[]>(
      "/admin/animals/suggest",
      { count },
    );
    for (const s of suggestions) {
      try {
        await api.post("/animals", s);
      } catch {
        // skip dupes
      }
    }
    await reload();
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {animals.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{a.name}</p>
                <p className="text-xs text-slate-500">{a.category ?? "—"}</p>
              </div>
              {a.has_guide ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                  Published
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Draft</span>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.short_description ?? "—"}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setEditing(a)} className="btn-secondary text-xs">
                Edit
              </button>
              <GuideEditor animal={a} onSaved={reload} />
            </div>
          </div>
        ))}
      </div>
    </div>
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
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

function GuideEditor({ animal, onSaved }: { animal: Animal; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState<GuideEntry | null>(null);
  const [busy, setBusy] = useState(false);

  async function openEditor() {
    setOpen(true);
    try {
      const g = await api.get<GuideEntry>(`/animals/${animal.slug}/guide`);
      setGuide(g);
    } catch {
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
        recommended_product_ids: "",
        is_published: false,
        updated_at: new Date().toISOString(),
      });
    }
  }

  async function generateDraft() {
    setBusy(true);
    try {
      const g = await api.post<GuideEntry>(`/admin/animals/${animal.id}/generate-guide`);
      setGuide(g);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!guide) return;
    setBusy(true);
    try {
      const g = await api.put<GuideEntry>(`/animals/${animal.id}/guide`, guide);
      setGuide(g);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={openEditor} className="btn-secondary text-xs">
        Edit guide
      </button>
    );
  }

  const fields: Array<[keyof GuideEntry, string, string?]> = [
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
    ["age_stages", "Birth-to-adult lifecycle (JSON array — stage, age_range, size, feeding, milestones, notes)"],
  ];

  return (
    <div className="col-span-3 mt-2 w-full">
      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold">{animal.name} — guide</h4>
          <div className="flex gap-2">
            <button onClick={generateDraft} disabled={busy} className="btn-secondary text-xs">
              {busy ? "Generating…" : "Draft via AI"}
            </button>
            <button onClick={() => setOpen(false)} className="btn-secondary text-xs">
              Close
            </button>
          </div>
        </div>
        {guide && (
          <>
            {fields.map(([key, label]) => (
              <div key={key as string}>
                <label className="label">{label}</label>
                <textarea
                  className="input min-h-[60px]"
                  value={(guide[key] as string | null) ?? ""}
                  onChange={(e) => setGuide({ ...guide, [key]: e.target.value })}
                />
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={guide.is_published}
                onChange={(e) => setGuide({ ...guide, is_published: e.target.checked })}
              />
              Publish (visible to paid members)
            </label>
            <button onClick={save} disabled={busy} className="btn-primary text-sm">
              {busy ? "Saving…" : "Save guide"}
            </button>
          </>
        )}
      </div>
    </div>
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

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
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
                <td className="px-4 py-2 text-center">{p.category}</td>
                <td className="px-4 py-2 text-center">{formatPrice(p.price_cents)}</td>
                <td className="px-4 py-2 text-center">{p.stock}</td>
                <td className="px-4 py-2 text-right">
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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...data, price_cents: Math.round(Number(priceDollars) * 100) };
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
