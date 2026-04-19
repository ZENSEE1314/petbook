import { useSyncExternalStore } from "react";
import type { Product } from "../api";

const KEY = "petbook.cart";

type CartMap = Record<number, { quantity: number; name: string; price_cents: number }>;

function read(): CartMap {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as CartMap;
  } catch {
    return {};
  }
}

function write(cart: CartMap) {
  localStorage.setItem(KEY, JSON.stringify(cart));
  for (const sub of subs) sub();
}

const subs = new Set<() => void>();
function subscribe(fn: () => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}

export const cart = {
  add(product: Product, qty = 1) {
    const c = read();
    const existing = c[product.id]?.quantity ?? 0;
    c[product.id] = {
      quantity: existing + qty,
      name: product.name,
      price_cents: product.price_cents,
    };
    write(c);
  },
  setQty(productId: number, qty: number) {
    const c = read();
    if (!c[productId]) return;
    if (qty <= 0) delete c[productId];
    else c[productId].quantity = qty;
    write(c);
  },
  remove(productId: number) {
    const c = read();
    delete c[productId];
    write(c);
  },
  clear() {
    write({});
  },
  read,
};

export function useCart() {
  return useSyncExternalStore(subscribe, read, read);
}

export function cartTotals(c: CartMap) {
  const items = Object.entries(c);
  let totalCents = 0;
  let totalQty = 0;
  for (const [, item] of items) {
    totalCents += item.price_cents * item.quantity;
    totalQty += item.quantity;
  }
  return { totalCents, totalQty, count: items.length };
}
