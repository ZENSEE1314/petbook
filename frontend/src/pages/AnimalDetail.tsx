import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type Animal, type GuideEntry, type Product } from "../api";
import { useAuth } from "../auth";
import { formatPrice } from "../lib/format";

export function AnimalDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [guide, setGuide] = useState<GuideEntry | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [paywalled, setPaywalled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setPaywalled(false);

    void api.get<Animal>(`/animals/${slug}`).then(setAnimal).catch(() => setAnimal(null));

    void api
      .get<GuideEntry>(`/animals/${slug}/guide`)
      .then(setGuide)
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 402) setPaywalled(true);
      })
      .finally(() => setLoading(false));

    void api.get<Product[]>(`/products?animal_slug=${slug}`).then(setRelated).catch(() => setRelated([]));
  }, [slug]);

  if (loading) return <p className="p-6 text-slate-500">Loading…</p>;
  if (!animal) return <p className="p-6 text-slate-500">Animal not found.</p>;

  const stages = parseStages(guide?.age_stages);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <header className="flex items-start justify-between">
        <div>
          <Link to="/guide" className="text-sm text-slate-500 hover:underline">
            ← All species
          </Link>
          <h1 className="mt-1 text-3xl font-bold">{animal.name}</h1>
          {animal.category && <p className="text-slate-500">{animal.category}</p>}
          {animal.short_description && <p className="mt-2 text-slate-700">{animal.short_description}</p>}
        </div>
        {animal.image_url && <img src={animal.image_url} alt="" className="h-32 w-32 rounded-lg object-cover" />}
      </header>

      {paywalled && (
        <div className="card border-brand-200 bg-brand-50 p-6 text-center">
          <h2 className="text-xl font-bold text-brand-700">Full guide is members-only</h2>
          <p className="mt-2 text-slate-700">
            Join Petbook for <strong>$10/year</strong> to unlock detailed care guides — diet, training, housing,
            age stages, and more.
          </p>
          <Link to="/subscribe" className="btn-primary mt-4 inline-flex">
            Upgrade now
          </Link>
          {!user && (
            <p className="mt-3 text-sm text-slate-500">
              Not registered? <Link to="/register" className="underline">Create an account first</Link>.
            </p>
          )}
        </div>
      )}

      {guide && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <GuideBlock title="Lifespan" body={guide.lifespan_years} />
            <GuideBlock title="Adult size" body={guide.adult_size} />
            <GuideBlock title="Diet" body={guide.diet} />
            <GuideBlock title="Housing" body={guide.housing} />
            <GuideBlock title="Training" body={guide.training} />
            <GuideBlock title="Signs of good health" body={guide.healthy_markers} />
            <GuideBlock title="Common issues" body={guide.common_issues} className="md:col-span-2" />
          </div>

          {stages.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-bold">Age stages</h2>
              <div className="grid gap-3 md:grid-cols-3">
                {stages.map((s, i) => (
                  <div key={i} className="card p-4">
                    <h3 className="font-semibold capitalize">{s.stage}</h3>
                    <p className="text-xs text-slate-500">{s.age_range}</p>
                    <dl className="mt-2 space-y-1 text-sm">
                      {s.size && <div><dt className="inline font-medium">Size: </dt><dd className="inline text-slate-700">{s.size}</dd></div>}
                      {s.feeding && <div><dt className="inline font-medium">Feeding: </dt><dd className="inline text-slate-700">{s.feeding}</dd></div>}
                      {s.notes && <div><dt className="inline font-medium">Notes: </dt><dd className="inline text-slate-700">{s.notes}</dd></div>}
                    </dl>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {related.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Recommended products</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <Link key={p.id} to={`/shop/${p.slug}`} className="card overflow-hidden hover:shadow-md">
                {p.image_url && <img src={p.image_url} alt="" className="h-32 w-full object-cover" />}
                <div className="p-3">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-sm font-semibold text-brand-600">{formatPrice(p.price_cents)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function GuideBlock({ title, body, className }: { title: string; body: string | null; className?: string }) {
  if (!body) return null;
  return (
    <section className={`card p-4 ${className ?? ""}`}>
      <h3 className="mb-1 font-semibold">{title}</h3>
      <p className="whitespace-pre-wrap text-sm text-slate-700">{body}</p>
    </section>
  );
}

type Stage = { stage: string; age_range: string; size?: string; feeding?: string; notes?: string };
function parseStages(json: string | null | undefined): Stage[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as Stage[]) : [];
  } catch {
    return [];
  }
}
