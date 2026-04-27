import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Animal } from "../api";

export function Guide() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    // Show only top-level (groups + standalone species). Children appear when
    // the user opens a parent like 'Snake'.
    void api.get<Animal[]>("/animals?top_level=true").then(setAnimals);
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

  const categoryEmoji: Record<string, string> = {
    mammal: "🐾",
    bird: "🪶",
    reptile: "🦎",
    amphibian: "🐸",
    fish: "🐟",
    invertebrate: "🦋",
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-6 rounded-3xl bg-gradient-to-br from-cream-100 via-cream-50 to-white p-6 shadow-elev-1 sm:p-8">
        <p className="eyebrow">Care guides</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Everything you need to raise a happy pet.
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Care guides written by keepers, curated by admins. Diet, training, housing, health signs
          and a birth-to-adult timeline for every species. Full guides unlock with membership.
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        <input
          className="input sm:max-w-xs"
          placeholder="Search species…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="input sm:max-w-xs" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <div className="text-3xl">🔎</div>
          <h3 className="font-display text-lg font-semibold">No species match your filter</h3>
          <p className="text-sm text-slate-600">Try a different keyword or clear the category.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => {
            const image = a.image_url ? (
              <img src={a.image_url} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-cream-100 to-brand-100 text-5xl">
                {categoryEmoji[a.category ?? ""] ?? "🐾"}
              </div>
            );
            const body = (
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold leading-tight">
                    {a.name}
                  </h3>
                  {a.child_count > 0 ? (
                    <span className="chip-brand shrink-0">{a.child_count} species</span>
                  ) : a.has_guide ? (
                    <span className="chip-sage shrink-0">Guide ready</span>
                  ) : (
                    <span className="chip-slate shrink-0">Coming soon</span>
                  )}
                </div>
                {a.category && <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">{a.category}</p>}
                {a.short_description && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.short_description}</p>
                )}
              </div>
            );

            const clickable = a.has_guide || a.child_count > 0;
            if (clickable) {
              return (
                <Link
                  key={a.id}
                  to={`/guide/${a.slug}`}
                  className="card-hover group overflow-hidden"
                >
                  {image}
                  {body}
                </Link>
              );
            }
            return (
              <div
                key={a.id}
                aria-disabled="true"
                title="Guide coming soon"
                className="card overflow-hidden opacity-70"
              >
                {image}
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
