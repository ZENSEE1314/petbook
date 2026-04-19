import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { cart, cartTotals, type ShipRegion, useCart } from "../lib/cart";
import { formatPrice } from "../lib/format";

export function Cart() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const cartMap = useCart();
  const [region, setRegion] = useState<ShipRegion>("local");
  const totals = cartTotals(cartMap, region);

  const [name, setName] = useState(user?.display_name ?? "");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      navigate("/login", { state: { from: "/cart" } });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const items = Object.entries(cartMap).map(([id, item]) => ({
        product_id: Number(id),
        quantity: item.quantity,
      }));
      const resp = await api.post<{ order_id: number; checkout_url: string | null }>(
        "/orders/checkout",
        {
          items,
          shipping_name: name,
          shipping_address: address,
          shipping_phone: phone || null,
          ship_region: region,
        },
      );
      cart.clear();
      if (resp.checkout_url) {
        window.location.href = resp.checkout_url;
      } else {
        navigate(`/orders/${resp.order_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  const entries = Object.entries(cartMap);

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <Link to="/shop" className="btn-primary mt-4 inline-flex">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 p-4 md:grid-cols-[1fr_320px]">
      <section className="card p-4">
        <h1 className="mb-4 text-2xl font-bold">Cart</h1>
        <ul className="divide-y divide-slate-200">
          {entries.map(([id, item]) => (
            <li key={id} className="flex items-center gap-3 py-3">
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-slate-500">{formatPrice(item.price_cents)} each</p>
              </div>
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => cart.setQty(Number(id), Number(e.target.value))}
                className="input w-16"
              />
              <button onClick={() => cart.remove(Number(id))} className="text-sm text-slate-400 hover:text-red-600">
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      <aside className="card h-fit p-4">
        <h2 className="text-lg font-bold">Checkout</h2>
        <form onSubmit={checkout} className="mt-3 space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Shipping address</label>
            <textarea className="input min-h-[80px]" required value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="label">Phone (optional)</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <label className="label">Shipping region</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRegion("local")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  region === "local"
                    ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                    : "border-slate-300 text-slate-600"
                }`}
              >
                Local
              </button>
              <button
                type="button"
                onClick={() => setRegion("overseas")}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  region === "overseas"
                    ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                    : "border-slate-300 text-slate-600"
                }`}
              >
                Overseas
              </button>
            </div>
          </div>

          <div className="space-y-1 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPrice(totals.subtotalCents)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Shipping ({region})</span>
              <span>{totals.shippingCents > 0 ? formatPrice(totals.shippingCents) : "Free"}</span>
            </div>
            <div className="flex justify-between pt-1 text-lg font-bold">
              <span>Total</span>
              <span>{formatPrice(totals.totalCents)}</span>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Placing order…" : user ? "Place order" : "Log in to place order"}
          </button>
          <p className="text-xs text-slate-500">
            You'll be taken to Stripe Checkout to complete payment.
          </p>
        </form>
      </aside>
    </div>
  );
}
