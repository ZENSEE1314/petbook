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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pet Listings</h1>
          <p className="text-slate-600">Find your next companion from other Petbook members.</p>
        </div>
        {user?.is_paid ? (
          <Link to="/listings/new" className="btn-primary">
            Post a listing
          </Link>
        ) : (
          <Link to="/subscribe" className="btn-secondary">
            Upgrade to list
          </Link>
        )}
      </div>

      {listings.length === 0 ? (
        <p className="py-10 text-center text-slate-500">No active listings yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <Link key={l.id} to={`/listings/${l.id}`} className="card overflow-hidden hover:shadow-md">
              {l.image_url ? (
                <img src={l.image_url} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center bg-slate-100 text-5xl">🐾</div>
              )}
              <div className="p-3">
                <p className="font-semibold">{l.title}</p>
                <p className="text-sm text-slate-500">
                  {l.animal_id ? animalById.get(l.animal_id)?.name : "Pet"} ·{" "}
                  {l.location ?? "location unspecified"}
                </p>
                <p className="mt-2 font-bold text-brand-600">{formatPrice(l.price_cents)}</p>
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
