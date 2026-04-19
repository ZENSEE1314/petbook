import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Animal, type Listing } from "../api";
import { useAuth } from "../auth";
import { formatDate, formatPrice } from "../lib/format";

export function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [animal, setAnimal] = useState<Animal | null>(null);

  useEffect(() => {
    if (!id) return;
    void api.get<Listing>(`/listings/${id}`).then(async (l) => {
      setListing(l);
      if (l.animal_id) {
        const animals = await api.get<Animal[]>("/animals");
        setAnimal(animals.find((a) => a.id === l.animal_id) ?? null);
      }
    });
  }, [id]);

  if (!listing) return <p className="p-6 text-slate-500">Loading…</p>;

  const isOwner = user && user.id === listing.seller_id;

  async function markSold() {
    if (!listing) return;
    const updated = await api.post<Listing>(`/listings/${listing.id}/mark-sold`);
    setListing(updated);
  }

  async function remove() {
    if (!listing) return;
    if (!confirm("Remove this listing?")) return;
    await api.del(`/listings/${listing.id}`);
    navigate("/listings");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Link to="/listings" className="text-sm text-slate-500 hover:underline">
        ← All listings
      </Link>
      {listing.image_url && (
        <img src={listing.image_url} alt="" className="w-full rounded-lg object-cover" />
      )}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{listing.title}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm capitalize">{listing.status}</span>
        </div>
        <p className="mt-1 text-slate-500">
          {animal && <Link to={`/guide/${animal.slug}`} className="hover:underline">{animal.name}</Link>}
          {animal && " · "}
          {listing.location ?? "Location not set"}
          {listing.age_months != null && ` · ${listing.age_months} months old`}
        </p>

        <p className="mt-4 text-3xl font-bold text-brand-600">{formatPrice(listing.price_cents)}</p>

        {listing.description && (
          <p className="mt-4 whitespace-pre-wrap text-slate-700">{listing.description}</p>
        )}

        <div className="mt-6 rounded-lg bg-slate-50 p-4">
          <h3 className="text-sm font-semibold">Contact the seller</h3>
          <p className="text-sm text-slate-600">
            {listing.seller_display_name ?? "Seller"} · listed {formatDate(listing.created_at)}
          </p>
          {user ? (
            <p className="mt-2 text-slate-800">{listing.contact ?? "Seller did not add contact details."}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              <Link to="/login" className="underline">Log in</Link> to see contact details.
            </p>
          )}
        </div>

        {isOwner && listing.status === "active" && (
          <div className="mt-6 flex gap-2">
            <button onClick={markSold} className="btn-secondary">
              Mark as sold
            </button>
            <button onClick={remove} className="btn-secondary text-red-600">
              Remove listing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
