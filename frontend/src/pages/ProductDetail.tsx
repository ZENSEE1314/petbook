import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Product } from "../api";
import { cart } from "../lib/cart";
import { formatPrice } from "../lib/format";

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!slug) return;
    void api.get<Product>(`/products/${slug}`).then(setProduct).catch(() => setProduct(null));
  }, [slug]);

  if (!product) return <p className="p-6 text-slate-500">Loading…</p>;

  const species = parseSlugs(product.suitable_for);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 p-4 md:grid-cols-2">
      {product.image_url ? (
        <img src={product.image_url} alt="" className="w-full rounded-lg object-cover" />
      ) : (
        <div className="flex h-64 w-full items-center justify-center rounded-lg bg-slate-100 text-6xl">🐾</div>
      )}
      <div>
        <Link to="/shop" className="text-sm text-slate-500 hover:underline">
          ← Back to shop
        </Link>
        <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>
        {product.category && <p className="text-slate-500">{product.category}</p>}
        <p className="mt-4 text-3xl font-bold text-brand-600">{formatPrice(product.price_cents)}</p>
        <p className="mt-2 text-sm text-slate-500">
          {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
        </p>
        {product.description && (
          <p className="mt-4 whitespace-pre-wrap text-slate-700">{product.description}</p>
        )}

        {species.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">Suitable for:</h3>
            <ul className="mt-1 flex flex-wrap gap-2">
              {species.map((s) => (
                <li key={s}>
                  <Link to={`/guide/${s}`} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200">
                    {s}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={Math.max(1, product.stock)}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            className="input w-20"
          />
          <button
            onClick={() => cart.add(product, qty)}
            disabled={product.stock <= 0}
            className="btn-primary"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}

function parseSlugs(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}
