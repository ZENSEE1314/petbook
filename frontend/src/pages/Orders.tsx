import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Order } from "../api";
import { formatDate, formatPrice } from "../lib/format";

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api.get<Order[]>("/orders").then(setOrders).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-bold">Your orders</h1>
      {orders.length === 0 ? (
        <p className="text-slate-500">No orders yet.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="card flex items-center justify-between p-4">
              <div>
                <Link to={`/orders/${o.id}`} className="font-semibold hover:underline">
                  Order #{o.id}
                </Link>
                <p className="text-sm text-slate-500">
                  {formatDate(o.created_at)} · {o.items.length} item{o.items.length === 1 ? "" : "s"} ·{" "}
                  <span className="capitalize">{o.status}</span>
                </p>
              </div>
              <p className="text-lg font-bold">{formatPrice(o.total_cents)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!id) return;
    void api.get<Order>(`/orders/${id}`).then(setOrder).catch(() => setOrder(null));
  }, [id]);

  if (!order) return <p className="p-6 text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link to="/orders" className="text-sm text-slate-500 hover:underline">
        ← Your orders
      </Link>
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Order #{order.id}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm capitalize">{order.status}</span>
        </div>
        <p className="mt-1 text-sm text-slate-500">{formatDate(order.created_at)}</p>

        <ul className="mt-4 divide-y divide-slate-200">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-2">
              <span>
                {i.product_name} × {i.quantity}
              </span>
              <span className="text-slate-700">{formatPrice(i.unit_price_cents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 font-bold">
          <span>Total</span>
          <span>{formatPrice(order.total_cents)}</span>
        </div>

        <div className="mt-6 text-sm text-slate-600">
          <h3 className="font-semibold">Shipping to</h3>
          <p>{order.shipping_name}</p>
          <p className="whitespace-pre-wrap">{order.shipping_address}</p>
          {order.shipping_phone && <p>Tel: {order.shipping_phone}</p>}
        </div>
      </div>
    </div>
  );
}
