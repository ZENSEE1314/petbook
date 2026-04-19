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
    <div className="mx-auto max-w-6xl p-4">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Shop</h1>
          <p className="text-slate-600">Food, toys, enclosures and accessories for every species.</p>
        </div>
        {totals.totalQty > 0 && (
          <Link to="/cart" className="btn-primary">
            Cart · {totals.totalQty} · {formatPrice(totals.totalCents)}
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search products…"
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
        <p className="py-10 text-center text-slate-500">No products match.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((p) => (
            <div key={p.id} className="card flex flex-col overflow-hidden">
              <Link to={`/shop/${p.slug}`} className="block">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-slate-100 text-4xl">🐾</div>
                )}
              </Link>
              <div className="flex flex-1 flex-col p-3">
                <Link to={`/shop/${p.slug}`} className="font-medium hover:underline">
                  {p.name}
                </Link>
                {p.category && <p className="text-xs text-slate-500">{p.category}</p>}
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="font-semibold text-brand-600">{formatPrice(p.price_cents)}</span>
                  <button
                    onClick={() => cart.add(p)}
                    disabled={p.stock <= 0}
                    className="btn-secondary text-sm disabled:text-slate-400"
                  >
                    {p.stock <= 0 ? "Out of stock" : "Add to cart"}
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
