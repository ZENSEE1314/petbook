import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  ApiError,
  type Animal,
  type GuideAnswer,
  type GuideEntry,
  type GuideMedia,
  type GuideQuestion,
  type Product,
  type ReviewsResponse,
} from "../api";
import { useAuth } from "../auth";
import { formatPrice, formatTimeAgo } from "../lib/format";

export function AnimalDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [guide, setGuide] = useState<GuideEntry | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [media, setMedia] = useState<GuideMedia[]>([]);
  const [children, setChildren] = useState<Animal[]>([]);
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
    void api
      .get<Animal[]>(`/animals?parent=${slug}`)
      .then(setChildren)
      .catch(() => setChildren([]));
  }, [slug]);

  if (loading) return <p className="p-6 text-slate-500">Loading…</p>;
  if (!animal) return <p className="p-6 text-slate-500">Animal not found.</p>;

  const stages = parseStages(guide?.age_stages);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <nav className="text-sm text-slate-500">
            <Link to="/guide" className="hover:underline">All species</Link>
            {animal.parent_slug && animal.parent_name && (
              <>
                {" / "}
                <Link to={`/guide/${animal.parent_slug}`} className="hover:underline">
                  {animal.parent_name}
                </Link>
              </>
            )}
            {" / "}<span className="text-slate-700">{animal.name}</span>
          </nav>
          <h1 className="mt-1 text-3xl font-bold">{animal.name}</h1>
          {animal.category && <p className="text-slate-500">{animal.category}</p>}
          {animal.short_description && <p className="mt-2 text-slate-700">{animal.short_description}</p>}
        </div>
        {animal.image_url && <img src={animal.image_url} alt="" className="h-32 w-32 shrink-0 rounded-lg object-cover" />}
      </header>

      {children.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl font-bold">
            Species under {animal.name} ({children.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((c) => {
              const clickable = c.has_guide || c.child_count > 0;
              const inner = (
                <>
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="h-32 w-full object-cover" />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-cream-100 to-brand-100 text-4xl">🐾</div>
                  )}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display font-semibold">{c.name}</p>
                      {c.has_guide ? (
                        <span className="chip-sage shrink-0">Guide</span>
                      ) : (
                        <span className="chip-slate shrink-0">Coming soon</span>
                      )}
                    </div>
                    {c.short_description && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{c.short_description}</p>
                    )}
                  </div>
                </>
              );
              return clickable ? (
                <Link key={c.id} to={`/guide/${c.slug}`} className="card-hover overflow-hidden">
                  {inner}
                </Link>
              ) : (
                <div key={c.id} className="card overflow-hidden opacity-70">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      )}

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
            {guide.lifespan_wild || guide.lifespan_pet ? (
              <>
                <Fact
                  label="🌿 Lifespan in the wild"
                  value={guide.lifespan_wild ? `${guide.lifespan_wild} years` : null}
                />
                <Fact
                  label="🏠 Lifespan as a pet"
                  value={guide.lifespan_pet ? `${guide.lifespan_pet} years` : null}
                />
              </>
            ) : (
              <Fact label="Lifespan" value={guide.lifespan_years ? `${guide.lifespan_years} years` : null} />
            )}
            <Fact label="Adult size" value={guide.adult_size} />
            <Fact label="Weight" value={guide.weight_range} />
            <Fact label="Length" value={guide.length_range} />
            <Fact label="Temperament" value={guide.temperament} />
          </section>

          <SexDiffTable guide={guide} />

          <div className="grid gap-4 md:grid-cols-2">
            <GuideBlock title="Colour variations" body={guide.colors} />
            <GuideBlock title="Diet" body={guide.diet} />
            <GuideBlock title="Housing" body={guide.housing} />
            <GuideBlock title="Training" body={guide.training} />
            <GuideBlock title="Signs of good health" body={guide.healthy_markers} />
            <GuideBlock title="Common issues" body={guide.common_issues} />
            <GuideBlock
              title="⚠ Foods to avoid"
              body={guide.foods_to_avoid}
              className="md:col-span-2 border-red-200 bg-red-50/50"
            />
            <GuideBlock
              title="🩺 Warning signs of sickness"
              body={guide.sickness_signs}
              className="md:col-span-2 border-amber-200 bg-amber-50/50"
            />
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

      {animal && <ReviewsSection animal={animal} />}
      {animal && <ForumSection animal={animal} />}

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

function SexDiffTable({ guide }: { guide: GuideEntry }) {
  const rows: Array<[string, string | null, string | null]> = [
    ["Weight", guide.weight_range_male, guide.weight_range_female],
    ["Length / height", guide.length_range_male, guide.length_range_female],
    ["Colours", guide.colors_male, guide.colors_female],
    ["Diet", guide.diet_male, guide.diet_female],
  ].filter(([, m, f]) => (m && m.trim()) || (f && f.trim())) as Array<[string, string | null, string | null]>;

  if (rows.length === 0) return null;

  return (
    <section className="card overflow-hidden">
      <h2 className="border-b border-slate-100 px-5 py-3 font-display text-xl font-bold">
        Male vs female
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2 font-semibold">Field</th>
              <th className="px-5 py-2 font-semibold">♂ Male</th>
              <th className="px-5 py-2 font-semibold">♀ Female</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, m, f]) => (
              <tr key={label} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-700">{label}</td>
                <td className="whitespace-pre-wrap px-5 py-3 text-slate-700">{m || "—"}</td>
                <td className="whitespace-pre-wrap px-5 py-3 text-slate-700">{f || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

// ---------- Reviews ----------

function Stars({ value, onChange, size = "md" }: { value: number; onChange?: (v: number) => void; size?: "sm" | "md" }) {
  const readOnly = !onChange;
  return (
    <div className={`inline-flex gap-0.5 ${size === "sm" ? "text-sm" : "text-xl"}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={`${n <= value ? "text-amber-400" : "text-slate-300"} transition ${
            !readOnly ? "hover:scale-110 cursor-pointer" : "cursor-default"
          }`}
          aria-label={`${n} stars`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewsSection({ animal }: { animal: Animal }) {
  const { user } = useAuth();
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [stars, setStars] = useState(5);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    try {
      setData(await api.get<ReviewsResponse>(`/animals/${animal.slug}/reviews`));
    } catch {
      setData({ summary: { average: 0, count: 0 }, reviews: [] });
    }
  }
  useEffect(() => {
    void reload();
  }, [animal.slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/animals/${animal.id}/reviews`, { stars, body: body || null });
      setBody("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const mine = data?.reviews.find((r) => r.user_id === user?.id);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Reviews</h2>
        {data && data.summary.count > 0 && (
          <p className="text-sm text-slate-600">
            <Stars value={Math.round(data.summary.average)} size="sm" />{" "}
            <span className="font-semibold">{data.summary.average.toFixed(1)}</span>{" "}
            <span className="text-slate-400">· {data.summary.count} review{data.summary.count === 1 ? "" : "s"}</span>
          </p>
        )}
      </div>

      {user ? (
        <form onSubmit={submit} className="card mb-4 space-y-3 p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">Your rating:</span>
            <Stars value={stars} onChange={setStars} />
          </div>
          <textarea
            className="input min-h-[70px]"
            placeholder={mine ? "Update your review…" : "Share your experience with this species (optional)"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
          />
          <button className="btn-primary text-sm" disabled={busy}>
            {busy ? "Saving…" : mine ? "Update my review" : "Post review"}
          </button>
        </form>
      ) : (
        <div className="card mb-4 p-4 text-center text-sm text-slate-600">
          <Link to="/register" className="text-brand-600 underline">Join</Link> to leave a rating and review.
        </div>
      )}

      {data && data.reviews.length === 0 ? (
        <p className="text-sm text-slate-500">No reviews yet — be the first.</p>
      ) : (
        <ul className="space-y-3">
          {data?.reviews.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{r.author_name ?? "Anonymous"}</p>
                  <Stars value={r.stars} size="sm" />
                </div>
                <p className="text-xs text-slate-400">{formatTimeAgo(r.created_at)}</p>
              </div>
              {r.body && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{r.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- Forum ----------

function ForumSection({ animal }: { animal: Animal }) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<GuideQuestion[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  async function reload() {
    try {
      setQuestions(await api.get<GuideQuestion[]>(`/animals/${animal.slug}/questions`));
    } catch {
      setQuestions([]);
    }
  }
  useEffect(() => {
    void reload();
  }, [animal.slug]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.post(`/animals/${animal.id}/questions`, { title, body: body || null });
      setTitle("");
      setBody("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-bold">Questions & answers</h2>

      {user ? (
        <form onSubmit={ask} className="card mb-4 space-y-3 p-4">
          <input
            className="input"
            placeholder="Your question title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className="input min-h-[70px]"
            placeholder="Details (optional) — what have you tried, any context?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <button className="btn-primary text-sm" disabled={busy || !title.trim()}>
            {busy ? "Posting…" : "Ask the community"}
          </button>
        </form>
      ) : (
        <div className="card mb-4 p-4 text-center text-sm text-slate-600">
          <Link to="/register" className="text-brand-600 underline">Join</Link> to ask questions or help other owners.
        </div>
      )}

      {questions.length === 0 ? (
        <p className="text-sm text-slate-500">No questions yet — start the conversation.</p>
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => (
            <QuestionItem
              key={q.id}
              question={q}
              isOpen={openId === q.id}
              onToggle={() => setOpenId(openId === q.id ? null : q.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function QuestionItem({
  question,
  isOpen,
  onToggle,
}: {
  question: GuideQuestion;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<GuideAnswer[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    void api
      .get<GuideAnswer[]>(`/animals/questions/${question.id}/answers`)
      .then(setAnswers)
      .catch(() => setAnswers([]));
  }, [isOpen, question.id]);

  async function answer(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const a = await api.post<GuideAnswer>(`/animals/questions/${question.id}/answers`, { body });
      setAnswers((prev) => [...(prev ?? []), a]);
      setBody("");
    } finally {
      setBusy(false);
    }
  }

  async function accept(a: GuideAnswer) {
    await api.post(`/animals/questions/${question.id}/accept/${a.id}`);
    setAnswers((prev) => prev?.map((x) => ({ ...x, accepted: x.id === a.id })) ?? null);
  }

  return (
    <li className="card overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-2 p-4 text-left hover:bg-slate-50"
      >
        <div className="min-w-0">
          <p className="font-semibold">{question.title}</p>
          {question.body && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{question.body}</p>}
          <p className="mt-1 text-xs text-slate-400">
            by {question.author_name ?? "anonymous"} · {formatTimeAgo(question.created_at)} ·{" "}
            {question.answer_count} answer{question.answer_count === 1 ? "" : "s"}
            {question.accepted_answer_id && <span className="ml-2 chip-sage">Resolved</span>}
          </p>
        </div>
        <span className="text-lg text-slate-400">{isOpen ? "−" : "+"}</span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 bg-slate-50 p-4">
          {answers === null ? (
            <p className="text-sm text-slate-500">Loading answers…</p>
          ) : answers.length === 0 ? (
            <p className="text-sm text-slate-500">No answers yet.</p>
          ) : (
            <ul className="space-y-3">
              {answers.map((a) => (
                <li key={a.id} className={`rounded-lg border p-3 text-sm ${a.accepted ? "border-sage-200 bg-sage-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{a.author_name ?? "anonymous"}</p>
                    <p className="text-xs text-slate-400">{formatTimeAgo(a.created_at)}</p>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{a.body}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {a.accepted ? (
                      <span className="chip-sage">Accepted by asker</span>
                    ) : (
                      user?.id === question.user_id && (
                        <button onClick={() => accept(a)} className="text-xs text-brand-600 hover:underline">
                          Mark as answer
                        </button>
                      )
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {user && (
            <form onSubmit={answer} className="mt-4 space-y-2">
              <textarea
                className="input min-h-[70px]"
                placeholder="Write your answer…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <button className="btn-primary text-sm" disabled={busy || !body.trim()}>
                {busy ? "Posting…" : "Post answer"}
              </button>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
function parseStages(json: string | null | undefined): Stage[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as Stage[]) : [];
  } catch {
    return [];
  }
}
