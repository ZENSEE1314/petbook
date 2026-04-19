import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type PublicUser, type UserPet } from "../api";
import { formatDate } from "../lib/format";

export function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [pets, setPets] = useState<UserPet[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    void api
      .get<PublicUser>(`/users/${id}`)
      .then(setUser)
      .catch(() => setNotFound(true));
    void api.get<UserPet[]>(`/users/${id}/pets`).then(setPets).catch(() => setPets([]));
  }, [id]);

  if (notFound) return <p className="p-8 text-center text-slate-500">User not found.</p>;
  if (!user) return <p className="p-8 text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="card overflow-hidden">
        <div className="bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white">
          <div className="flex items-center gap-4">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.display_name ?? "avatar"}
                className="h-20 w-20 rounded-full border-2 border-white/30 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/15 font-display text-3xl">
                {(user.display_name ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">
                {user.display_name ?? "Anonymous"}
              </h1>
              <p className="text-sm text-brand-100/90">Joined {formatDate(user.created_at)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                  Level {user.level}
                </span>
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                  {user.points.toLocaleString()} points
                </span>
              </div>
            </div>
          </div>
        </div>
        {user.bio && (
          <div className="p-5">
            <p className="whitespace-pre-wrap text-sm text-slate-700">{user.bio}</p>
          </div>
        )}
      </header>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">
          Pets ({pets.length})
        </h2>
        {pets.length === 0 ? (
          <p className="text-sm text-slate-500">No pets added yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {pets.map((p) => (
              <article key={p.id} className="card-hover overflow-hidden">
                {p.photo_url ? (
                  <img src={p.photo_url} alt={p.name} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center bg-gradient-to-br from-cream-100 to-brand-100 text-5xl">
                    🐾
                  </div>
                )}
                <div className="p-4">
                  <p className="font-display text-lg font-semibold">{p.name}</p>
                  {p.animal_name && (
                    <p className="text-xs text-slate-500">
                      {p.animal_slug ? (
                        <Link to={`/guide/${p.animal_slug}`} className="hover:underline">
                          {p.animal_name}
                        </Link>
                      ) : (
                        p.animal_name
                      )}
                      {p.birth_date && ` · born ${formatDate(p.birth_date)}`}
                    </p>
                  )}
                  {p.bio && <p className="mt-2 text-sm text-slate-700">{p.bio}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
