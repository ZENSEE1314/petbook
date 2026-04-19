import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Animal, type Comment, type Post } from "../api";
import { useAuth } from "../auth";
import { ImageUpload } from "../components/ImageUpload";
import { formatTimeAgo } from "../lib/format";

export function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([api.get<Post[]>("/posts"), api.get<Animal[]>("/animals")])
      .then(([p, a]) => {
        setPosts(p);
        setAnimals(a);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      {!user && (
        <section className="rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 p-6 text-white shadow-elev-3 sm:p-8">
          <p className="eyebrow !text-white/80">Petbook · social</p>
          <h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">
            Share your pet's day. Shop for their tomorrow.
          </h1>
          <p className="mt-3 max-w-md text-brand-50/90">
            A cosy home for pet owners — a social feed, science-backed care guides, and a trusted shop.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/register" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-elev-1 hover:bg-cream-50">
              Join free
            </Link>
            <Link to="/guide" className="rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
              Browse pet guides
            </Link>
          </div>
        </section>
      )}

      {user && (
        <PostComposer animals={animals} onCreated={(p) => setPosts((prev) => [p, ...prev])} />
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : posts.length === 0 ? (
        <div className="card fade-in flex flex-col items-center gap-3 p-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-3xl">🐾</div>
          <h3 className="font-display text-xl font-semibold">No posts yet</h3>
          <p className="max-w-xs text-sm text-slate-600">
            Be the first to share a photo of your pet. Paws, whiskers, scales — we welcome them all.
          </p>
          {!user && (
            <Link to="/register" className="btn-primary mt-2">Create an account</Link>
          )}
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            animal={animals.find((a) => a.id === post.animal_id)}
            onUpdate={(updated) =>
              setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            }
            onDelete={() => setPosts((prev) => prev.filter((p) => p.id !== post.id))}
          />
        ))
      )}
    </div>
  );
}

function PostComposer({ animals, onCreated }: { animals: Animal[]; onCreated: (p: Post) => void }) {
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [animalId, setAnimalId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!caption.trim()) return;
    setBusy(true);
    try {
      const post = await api.post<Post>("/posts", {
        caption,
        image_url: imageUrl,
        animal_id: animalId ? Number(animalId) : null,
      });
      onCreated(post);
      setCaption("");
      setImageUrl(null);
      setAnimalId("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-4">
      <textarea
        className="input min-h-[80px]"
        placeholder="Share something about your pet…"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={4000}
      />
      <ImageUpload value={imageUrl} onChange={setImageUrl} label="Photo (optional)" />
      <div className="flex items-center gap-2">
        <select className="input max-w-[220px]" value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
          <option value="">What species?</option>
          {animals.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <button className="btn-primary ml-auto" disabled={busy || !caption.trim()}>
          Post
        </button>
      </div>
    </form>
  );
}

function PostCard({
  post,
  animal,
  onUpdate,
  onDelete,
}: {
  post: Post;
  animal?: Animal;
  onUpdate: (p: Post) => void;
  onDelete: () => void;
}) {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");

  async function toggleLike() {
    if (!user) return;
    const method = post.liked_by_me ? api.del : api.post;
    try {
      await method(`/posts/${post.id}/like`);
      onUpdate({
        ...post,
        liked_by_me: !post.liked_by_me,
        like_count: post.like_count + (post.liked_by_me ? -1 : 1),
      });
    } catch {
      // ignore
    }
  }

  async function openComments() {
    setShowComments((v) => !v);
    if (!showComments && !comments) {
      const list = await api.get<Comment[]>(`/posts/${post.id}/comments`);
      setComments(list);
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const c = await api.post<Comment>(`/posts/${post.id}/comments`, { body });
    setComments((prev) => [...(prev ?? []), c]);
    onUpdate({ ...post, comment_count: post.comment_count + 1 });
    setBody("");
  }

  async function deleteMine() {
    if (!confirm("Delete this post?")) return;
    await api.del(`/posts/${post.id}`);
    onDelete();
  }

  return (
    <article className="card overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3">
        <Link to={`/u/${post.author.id}`} className="flex items-center gap-2 hover:opacity-80">
          {post.author.avatar_url ? (
            <img src={post.author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              {(post.author.display_name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{post.author.display_name ?? "Anonymous"}</p>
            <p className="text-xs text-slate-500">
              {formatTimeAgo(post.created_at)}
              {animal && <> · <span className="hover:underline">{animal.name}</span></>}
            </p>
          </div>
        </Link>
        {(user?.id === post.author.id || user?.is_admin) && (
          <button onClick={deleteMine} className="text-xs text-slate-400 hover:text-red-600">
            Delete
          </button>
        )}
      </header>

      {post.image_url && <img src={post.image_url} alt="" className="w-full object-cover" />}

      <div className="px-4 py-3">
        <p className="whitespace-pre-wrap text-sm">{post.caption}</p>
      </div>

      <footer className="flex items-center gap-4 border-t border-slate-100 px-4 py-2 text-sm">
        <button
          onClick={toggleLike}
          disabled={!user}
          className={`flex items-center gap-1 ${post.liked_by_me ? "text-brand-600" : "text-slate-600"} hover:text-brand-600 disabled:cursor-not-allowed`}
        >
          {post.liked_by_me ? "❤️" : "🤍"} {post.like_count}
        </button>
        <button onClick={openComments} className="flex items-center gap-1 text-slate-600 hover:text-slate-900">
          💬 {post.comment_count}
        </button>
      </footer>

      {showComments && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          {comments === null ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-slate-500">No comments yet.</p>
          ) : (
            <ul className="mb-3 space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <Link to={`/u/${c.author.id}`} className="font-semibold hover:underline">
                    {c.author.display_name ?? "Anonymous"}
                  </Link>{" "}
                  <span className="text-slate-700">{c.body}</span>
                </li>
              ))}
            </ul>
          )}
          {user && (
            <form onSubmit={addComment} className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Add a comment…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
              />
              <button className="btn-primary" disabled={!body.trim()}>
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
