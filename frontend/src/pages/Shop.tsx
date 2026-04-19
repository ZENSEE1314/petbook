import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Product } from "../api";
import { cart, cartTotals, useCart } from "../lib/cart";
import { formatPrice } from "../lib/format";

export function Shop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const cartMap = useCart();
  const totals = cartTotals(cartMap);

  useEffect(() => {
    void api.get<Product[]>("/products").then(setProducts);
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[],
    [products],
  );

  const filtered = products.filter((p) => {
    if (category && p.category !== category) return false;
    if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Petbook shop</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything for happy pets.
          </h1>
          <p className="mt-1 text-slate-600">Food, toys, enclosures and accessories — curated for every species.</p>
        </div>
        {totals.totalQty > 0 && (
          <Link to="/cart" className="btn-primary">
            🛒 {totals.totalQty} · {formatPrice(totals.totalCents)}
          </Link>
        )}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <input
          className="input sm:max-w-xs"
          placeholder="Search products…"
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
          <div className="text-3xl">🛍️</div>
          <h3 className="font-display text-lg font-semibold">Nothing matches</h3>
          <p className="text-sm text-slate-600">Try a different keyword or clear the category.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((p) => (
            <div key={p.id} className="card-hover group flex flex-col overflow-hidden">
              <Link to={`/shop/${p.slug}`} className="block">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="aspect-square w-full object-cover transition group-hover:scale-[1.02]" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-cream-100 to-brand-100 text-5xl">🐾</div>
                )}
              </Link>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <Link to={`/shop/${p.slug}`} className="line-clamp-2 font-display text-base font-semibold leading-snug hover:text-brand-700">
                  {p.name}
                </Link>
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  {p.category && <span className="chip-slate capitalize">{p.category}</span>}
                  {p.ship_local_cents === 0 && <span className="chip-sage">Free local shipping</span>}
                </div>
                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className="font-display text-lg font-bold text-brand-600">{formatPrice(p.price_cents)}</span>
                  <button
                    onClick={() => cart.add(p)}
                    disabled={p.stock <= 0}
                    className="btn-secondary text-sm disabled:text-slate-400"
                  >
                    {p.stock <= 0 ? "Out of stock" : "Add"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
