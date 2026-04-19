import { useState } from "react";
import { api } from "../api";

export function ImageUpload({
  value,
  onChange,
  label = "Image",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.upload("/uploads/image", file);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      {value && (
        <div className="mb-2">
          <img src={value} alt="" className="max-h-48 rounded-md border border-slate-200" />
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-200"
      />
      {busy && <p className="mt-1 text-xs text-slate-500">Uploading…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-1 text-xs text-slate-500 underline hover:text-slate-700"
        >
          Remove image
        </button>
      )}
    </div>
  );
}
