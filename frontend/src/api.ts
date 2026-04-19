const API = "/api";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, String(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: async (path: string, file: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { ...authHeader() },
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, res.statusText);
    return res.json();
  },
};

// ---------- Shared types ----------

export type User = {
  id: number;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_active: boolean;
  is_admin: boolean;
  is_paid: boolean;
  paid_until: string | null;
  created_at: string;
};

export type Animal = {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  short_description: string | null;
  image_url: string | null;
  has_guide: boolean;
};

export type GuideEntry = {
  id: number;
  animal_id: number;
  story: string | null;
  origin: string | null;
  temperament: string | null;
  colors: string | null;
  lifespan_years: string | null;
  weight_range: string | null;
  length_range: string | null;
  adult_size: string | null;
  healthy_markers: string | null;
  diet: string | null;
  training: string | null;
  housing: string | null;
  common_issues: string | null;
  age_stages: string | null;
  recommended_product_ids: string | null;
  is_published: boolean;
  updated_at: string;
};

export type AuthorMini = {
  id: number;
  display_name: string | null;
  avatar_url: string | null;
};

export type Post = {
  id: number;
  author: AuthorMini;
  animal_id: number | null;
  caption: string;
  image_url: string | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  created_at: string;
};

export type Comment = {
  id: number;
  author: AuthorMini;
  body: string;
  created_at: string;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  price_cents: number;
  stock: number;
  image_url: string | null;
  suitable_for: string | null;
  is_active: boolean;
};

export type Order = {
  id: number;
  user_id: number;
  total_cents: number;
  status: string;
  shipping_name: string | null;
  shipping_address: string | null;
  shipping_phone: string | null;
  items: Array<{
    id: number;
    product_id: number;
    product_name: string;
    unit_price_cents: number;
    quantity: number;
  }>;
  created_at: string;
};

export type Listing = {
  id: number;
  seller_id: number;
  seller_display_name: string | null;
  animal_id: number | null;
  title: string;
  description: string | null;
  age_months: number | null;
  price_cents: number;
  location: string | null;
  contact: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
};
