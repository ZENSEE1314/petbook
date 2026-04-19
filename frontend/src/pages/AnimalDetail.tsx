import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, type Animal, type GuideEntry, type GuideMedia, type Product } from "../api";
import { useAuth } from "../auth";
import { formatPrice } from "../lib/format";

export function AnimalDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [guide, setGuide] = useState<GuideEntry | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [media, setMedia] = useState<GuideMedia[]>([]);
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
    void api.get<GuideMedia[]>(`/animals/${slug}/media`).then(setMedia).catch(() => setMedia([]));
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
          {guide.story && (
            <section className="card p-5">
              <h2 className="mb-2 text-xl font-bold">The story</h2>
              <p className="whitespace-pre-wrap text-slate-700">{guide.story}</p>
            </section>
          )}

          <section className="grid gap-3 rounded-xl bg-white p-4 text-sm shadow-sm md:grid-cols-3">
            <Fact label="Origin" value={guide.origin} />
            <Fact label="Lifespan" value={guide.lifespan_years ? `${guide.lifespan_years} years` : null} />
            <Fact label="Adult size" value={guide.adult_size} />
            <Fact label="Weight" value={guide.weight_range} />
            <Fact label="Length" value={guide.length_range} />
            <Fact label="Temperament" value={guide.temperament} />
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <GuideBlock title="Colour variations" body={guide.colors} />
            <GuideBlock title="Diet" body={guide.diet} />
            <GuideBlock title="Housing" body={guide.housing} />
            <GuideBlock title="Training" body={guide.training} />
            <GuideBlock title="Signs of good health" body={guide.healthy_markers} />
            <GuideBlock title="Common issues" body={guide.common_issues} />
          </div>

          {(guide.sexing || guide.breeding_guide || guide.breeding_frequency || guide.litter_size) && (
            <section>
              <h2 className="mb-3 text-xl font-bold">Breeding</h2>
              <div className="mb-3 grid gap-3 rounded-xl bg-white p-4 text-sm shadow-sm sm:grid-cols-2">
                <Fact label="Breeding frequency" value={guide.breeding_frequency} />
                <Fact label="Litter / clutch size" value={guide.litter_size} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <GuideBlock title="Male vs female" body={guide.sexing} />
                <GuideBlock title="How to breed" body={guide.breeding_guide} />
              </div>
            </section>
          )}

          {stages.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-bold">From birth to adult</h2>
              <ol className="space-y-3">
                {stages.map((s, i) => (
                  <li key={i} className="card flex gap-4 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h3 className="font-semibold capitalize">{s.stage}</h3>
                        <span className="text-xs text-slate-500">{s.age_range}</span>
                      </div>
                      <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                        {s.size && <div><dt className="inline font-medium">Size: </dt><dd className="inline text-slate-700">{s.size}</dd></div>}
                        {s.feeding && <div><dt className="inline font-medium">Feeding: </dt><dd className="inline text-slate-700">{s.feeding}</dd></div>}
                        {s.milestones && <div className="sm:col-span-2"><dt className="inline font-medium">Milestones: </dt><dd className="inline text-slate-700">{s.milestones}</dd></div>}
                        {s.notes && <div className="sm:col-span-2"><dt className="inline font-medium">Notes: </dt><dd className="inline text-slate-700">{s.notes}</dd></div>}
                      </dl>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}

      {media.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Training tutorials</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {media.map((m) => (
              <article key={m.id} className="card overflow-hidden">
                {m.kind === "video" ? (
                  <video
                    src={m.url}
                    controls
                    preload="metadata"
                    poster={m.poster_url ?? undefined}
                    className="w-full bg-black"
                  />
                ) : m.kind === "audio" ? (
                  <div className="flex items-center gap-3 bg-gradient-to-br from-cream-100 to-brand-100 p-4">
                    <div className="text-3xl">🎧</div>
                    <audio src={m.url} controls preload="metadata" className="w-full" />
                  </div>
                ) : (
                  <img src={m.url} alt={m.title ?? ""} className="w-full object-cover" />
                )}
                <div className="p-4">
                  {m.title && <h3 className="font-semibold">{m.title}</h3>}
                  {m.caption && <p className="mt-1 text-sm text-slate-600">{m.caption}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
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

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value}</dd>
    </div>
  );
}

type Stage = {
  stage: string;
  age_range: string;
  size?: string;
  feeding?: string;
  milestones?: string;
  notes?: string;
};
function parseStages(json: string | null | undefined): Stage[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as Stage[]) : [];
  } catch {
    return [];
  }
}
