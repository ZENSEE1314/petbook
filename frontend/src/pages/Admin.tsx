import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api, type Animal, type GuideEntry, type Order, type Product, type User } from "../api";
import { ImageUpload } from "../components/ImageUpload";
import { formatDate, formatPrice, formatTimeAgo } from "../lib/format";

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
        <NavLink to="/admin/orders" className={tabClass}>Orders</NavLink>
      </nav>
      <Routes>
        <Route index element={<Users />} />
        <Route path="animals" element={<Animals />} />
        <Route path="products" element={<Products />} />
        <Route path="orders" element={<Orders />} />
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
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function openEditor() {
    setOpen(true);
    setMessage(null);
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
    setMessage(null);
    try {
      const g = await api.post<GuideEntry>(`/admin/animals/${animal.id}/generate-guide`);
      setGuide(g);
      setMessage({ kind: "ok", text: "Draft loaded — review each field then Save guide." });
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
            <div className="flex items-center gap-3">
              <button onClick={save} disabled={busy} className="btn-primary text-sm">
                {busy ? "Saving…" : "Save guide"}
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
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">Orders ({orders.length})</h2>
        <div className="ml-auto flex flex-wrap gap-1">
          <FilterChip active={filter === ""} label={`All · ${orders.length}`} onClick={() => setFilter("")} />
          {["pending", "paid", "ready_to_ship", "shipped", "delivered", "cancelled"].map((s) => (
            <FilterChip
              key={s}
              active={filter === s}
              label={`${s.replace("_", " ")} · ${counts[s] ?? 0}`}
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
                <div className="grid items-center gap-3 p-4 md:grid-cols-[80px_1fr_1fr_120px_160px_auto]">
                  <button onClick={() => setExpanded(isOpen ? null : o.id)} className="text-left">
                    <span className="font-semibold text-brand-600">#{o.id}</span>
                    <p className="text-xs text-slate-500">{formatTimeAgo(o.created_at)}</p>
                  </button>
                  <div>
                    <p className="text-sm font-medium">{o.buyer_display_name ?? "—"}</p>
                    <p className="text-xs text-slate-500">{o.buyer_email}</p>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p>{o.shipping_name ?? "—"}</p>
                    <p className="line-clamp-1 text-xs text-slate-400">{o.shipping_address}</p>
                  </div>
                  <p className="text-right font-semibold">{formatPrice(o.total_cents)}</p>
                  <span className={`justify-self-start rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[o.status] ?? "bg-slate-100 text-slate-700"}`}>
                    {o.status.replace("_", " ")}
                  </span>
                  <div className="flex justify-end gap-2">
                    {action ? (
                      <button
                        onClick={() => advance(o)}
                        disabled={busy === o.id}
                        className="btn-primary text-xs"
                      >
                        {busy === o.id ? "…" : action.label}
                      </button>
                    ) : null}
                    {o.status !== "delivered" && o.status !== "cancelled" && (
                      <button onClick={() => cancel(o)} className="btn-secondary text-xs text-red-600">
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
      className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
        active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
