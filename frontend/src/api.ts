const API = "/api";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
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
  points: number;
  referral_code: string | null;
  created_at: string;
};

export type PublicUser = {
  id: number;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  points: number;
  level: number;
  created_at: string;
};

export type UserPet = {
  id: number;
  owner_id: number;
  animal_id: number | null;
  animal_slug: string | null;
  animal_name: string | null;
  name: string;
  photo_url: string | null;
  bio: string | null;
  birth_date: string | null;
  created_at: string;
};

export type PointsEvent = {
  id: number;
  kind: string;
  points: number;
  ref_type: string | null;
  ref_id: number | null;
  note: string | null;
  created_at: string;
};

export type PointsMe = {
  level: number;
  points: number;
  current_floor: number;
  next_floor: number | null;
  progress: number;
  referral_code: string | null;
  events: PointsEvent[];
};

export type PointsConfig = {
  post_created: number;
  post_liked: number;
  comment_created: number;
  listing_created: number;
  listing_sold: number;
  order_per_dollar: number;
  referral_signup: number;
  referral_joiner_bonus: number;
  review_created: number;
  answer_created: number;
  answer_accepted: number;
  level_thresholds: string;
};

export type GuideReview = {
  id: number;
  animal_id: number;
  user_id: number;
  author_name: string | null;
  stars: number;
  body: string | null;
  created_at: string;
};

export type ReviewsResponse = {
  summary: { average: number; count: number };
  reviews: GuideReview[];
};

export type GuideQuestion = {
  id: number;
  animal_id: number;
  user_id: number;
  author_name: string | null;
  title: string;
  body: string | null;
  created_at: string;
  answer_count: number;
  accepted_answer_id: number | null;
};

export type GuideAnswer = {
  id: number;
  question_id: number;
  user_id: number;
  author_name: string | null;
  body: string;
  created_at: string;
  accepted: boolean;
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

export type GuideMedia = {
  id: number;
  animal_id: number;
  kind: "video" | "audio" | "image";
  url: string;
  title: string | null;
  caption: string | null;
  poster_url: string | null;
  position: number;
  created_at: string;
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
  sexing: string | null;
  breeding_guide: string | null;
  breeding_frequency: string | null;
  litter_size: string | null;
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
  ship_local_cents: number;
  ship_overseas_cents: number;
  is_active: boolean;
};

export type Order = {
  id: number;
  user_id: number;
  buyer_email: string | null;
  buyer_display_name: string | null;
  total_cents: number;
  shipping_cents: number;
  ship_region: string;
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

export type SiteSettings = {
  site_name: string;
  tagline: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  theme_color: string;
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
