import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Animal, type Listing } from "../api";
import { useAuth } from "../auth";
import { formatPrice, formatTimeAgo } from "../lib/format";

export function Listings() {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);

  useEffect(() => {
    void api.get<Listing[]>("/listings").then(setListings);
    void api.get<Animal[]>("/animals").then(setAnimals);
  }, []);

  const animalById = new Map(animals.map((a) => [a.id, a]));

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Marketplace</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">Pet Listings</h1>
          <p className="text-slate-600">Find your next companion from other Petbook members.</p>
        </div>
        {user?.is_paid ? (
          <Link to="/listings/new" className="btn-primary">
            + Post a listing
          </Link>
        ) : (
          <Link to="/subscribe" className="btn-secondary">
            Upgrade to list
          </Link>
        )}
      </div>

      {listings.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <div className="text-3xl">🐾</div>
          <h3 className="font-display text-lg font-semibold">No active listings yet</h3>
          <p className="max-w-sm text-sm text-slate-600">
            When members list their pets, they'll appear here. Members can post listings any time.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Link key={l.id} to={`/listings/${l.id}`} className="card-hover group overflow-hidden">
              {l.image_url ? (
                <img src={l.image_url} alt="" className="h-44 w-full object-cover transition group-hover:scale-[1.02]" />
              ) : (
                <div className="flex h-44 items-center justify-center bg-gradient-to-br from-cream-100 to-brand-100 text-5xl">🐾</div>
              )}
              <div className="p-4">
                <p className="font-display text-lg font-semibold leading-tight group-hover:text-brand-700">{l.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {l.animal_id ? animalById.get(l.animal_id)?.name : "Pet"} ·{" "}
                  {l.location ?? "location unspecified"}
                </p>
                <p className="mt-2 font-display text-xl font-bold text-brand-600">{formatPrice(l.price_cents)}</p>
                <p className="mt-1 text-xs text-slate-400">
                  by {l.seller_display_name ?? "Seller"} · {formatTimeAgo(l.created_at)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
