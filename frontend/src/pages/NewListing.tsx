import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Animal, type Listing } from "../api";
import { ImageUpload } from "../components/ImageUpload";

export function NewListing() {
  const navigate = useNavigate();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [animalId, setAnimalId] = useState("");
  const [ageMonths, setAgeMonths] = useState("");
  const [priceDollars, setPriceDollars] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.get<Animal[]>("/animals").then(setAnimals);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const listing = await api.post<Listing>("/listings", {
        title,
        description: description || null,
        animal_id: animalId ? Number(animalId) : null,
        age_months: ageMonths ? Number(ageMonths) : null,
        price_cents: Math.round(Number(priceDollars) * 100),
        location: location || null,
        contact: contact || null,
        image_url: imageUrl,
      });
      navigate(`/listings/${listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create listing");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-2xl font-bold">New listing</h1>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div>
          <label className="label">Title</label>
          <input className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Species</label>
            <select className="input" value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
              <option value="">Select species</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Age (months)</label>
            <input className="input" type="number" min={0} value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Price (USD)</label>
            <input className="input" type="number" min={0} step="0.01" required value={priceDollars} onChange={(e) => setPriceDollars(e.target.value)} />
          </div>
          <div>
            <label className="label">Location</label>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, country" />
          </div>
        </div>

        <div>
          <label className="label">Contact (phone or email to share)</label>
          <input className="input" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[120px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <ImageUpload value={imageUrl} onChange={setImageUrl} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating…" : "Publish listing"}
        </button>
      </form>
    </div>
  );
}
