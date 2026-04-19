import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Animal } from "../api";

export function Guide() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    void api.get<Animal[]>("/animals").then(setAnimals);
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(animals.map((a) => a.category).filter(Boolean))) as string[],
    [animals],
  );

  const filtered = animals.filter((a) => {
    if (category && a.category !== category) return false;
    if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Pet Guide</h1>
        <p className="mt-1 text-slate-600">
          Care guides written by keepers, curated by admins. Full guides require a paid membership.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search species…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input max-w-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-slate-500">No species found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Link key={a.id} to={`/guide/${a.slug}`} className="card overflow-hidden hover:shadow-md">
              {a.image_url && <img src={a.image_url} alt="" className="h-32 w-full object-cover" />}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{a.name}</h3>
                  {a.has_guide ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      Guide ready
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                      Coming soon
                    </span>
                  )}
                </div>
                {a.category && <p className="text-xs text-slate-500">{a.category}</p>}
                {a.short_description && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.short_description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
