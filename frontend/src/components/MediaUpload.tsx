import { useState } from "react";

type Result = { url: string; kind: "video" | "audio" | "image" };

export function MediaUpload({
  label = "Upload video / audio / image",
  accept = "video/*,audio/*,image/*",
  onUploaded,
}: {
  label?: string;
  accept?: string;
  onUploaded: (result: Result) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      // Use XHR so we can report upload progress (fetch lacks upload progress).
      const result = await new Promise<Result>((resolve, reject) => {
        const form = new FormData();
        form.append("file", file);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/uploads/media");
        const token = localStorage.getItem("token");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Bad server response"));
            }
          } else {
            let detail = xhr.statusText || `HTTP ${xhr.status}`;
            try {
              const body = JSON.parse(xhr.responseText);
              detail = body.detail ?? detail;
            } catch {}
            reject(new Error(detail));
          }
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(form);
      });
      onUploaded(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-200"
      />
      {busy && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Uploading… {progress}%</p>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-slate-400">
        MP4 / WebM / MOV (video), MP3 / M4A / WAV (audio), JPG / PNG (image). Max 100 MB.
      </p>
    </div>
  );
}
