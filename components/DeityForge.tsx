"use client";
/* eslint-disable @next/next/no-img-element */

import {
  CSSProperties,
  FormEvent,
  useRef,
  useState,
} from "react";

export type CustomDeity = {
  id: string;
  kind: "custom_deity";
  name: string;
  prompt: string;
  imageId: string | null;
  image: string | null;
  accent: string;
  randomEnabled: boolean;
  createdAt: number;
  updatedAt: number;
};

export function DeityForge({
  open,
  deity,
  onClose,
  onSaved,
}: {
  open: boolean;
  deity: CustomDeity | null;
  onClose: () => void;
  onSaved: (deity: CustomDeity, created: boolean) => void;
}) {
  const [name, setName] = useState(deity?.name || "");
  const [prompt, setPrompt] = useState(deity?.prompt || "");
  const [randomEnabled, setRandomEnabled] = useState(
    deity?.randomEnabled ?? true,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    deity?.image || null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("name", name);
    form.set("prompt", prompt);
    form.set("randomEnabled", String(randomEnabled));
    form.set("removeImage", String(removeImage));
    if (imageFile) form.set("image", imageFile);
    const response = await fetch(
      deity ? `/api/deities/${deity.id}` : "/api/deities",
      { method: deity ? "PATCH" : "POST", body: form },
    );
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error || "造神未能完成");
      return;
    }
    onSaved(data as CustomDeity, !deity);
  }

  function chooseImage(file: File | undefined) {
    if (!file) return;
    setImageFile(file);
    setRemoveImage(false);
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () =>
        setPreviewUrl(
          typeof reader.result === "string" ? reader.result : null,
        ),
      { once: true },
    );
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImageFile(null);
    setPreviewUrl(null);
    setRemoveImage(true);
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div
      className="deity-forge-layer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deity-forge-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section className="deity-forge">
        <button
          className="deity-forge-close"
          type="button"
          aria-label="返回"
          onClick={onClose}
          disabled={busy}
        >
          ×
        </button>
        <header>
          <p className="eyebrow">
            {deity ? "REFORGE THE DEITY" : "DEITY FORGE"}
          </p>
          <h2 id="deity-forge-title">
            {deity ? "重塑神格" : "造神"}
          </h2>
          <p>
            {deity
              ? "新的神格只作用于未来。已经降下的神谕，将保持原貌。"
              : "为一位尚未显形的神明赋名，设定神格，并留下一枚可辨认的显像。"}
          </p>
        </header>

        <form onSubmit={submit}>
          <div className="deity-forge-grid">
            <div className="deity-manifestation">
              <span className="deity-field-label">
                <small>MANIFESTATION</small>
                神明显像
              </span>
              <button
                type="button"
                className={`deity-image-well ${previewUrl ? "has-image" : ""}`}
                onClick={() => fileInput.current?.click()}
                aria-label={previewUrl ? "更换显像" : "置入显像"}
                style={
                  {
                    "--deity-accent": deity?.accent || "#c9a65b",
                  } as CSSProperties
                }
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="" />
                ) : (
                  <>
                    <strong>{name.trim().slice(0, 1) || "?"}</strong>
                    <span>尚未留下显像</span>
                  </>
                )}
              </button>
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => chooseImage(event.target.files?.[0])}
              />
              <div className="deity-image-actions">
                <button type="button" onClick={() => fileInput.current?.click()}>
                  {previewUrl ? "更换显像" : "置入显像"}
                </button>
                {previewUrl && (
                  <button type="button" onClick={clearImage}>
                    撤去显像
                  </button>
                )}
              </div>
              <p>支持 JPG、PNG、WebP，最大 2MB。</p>
            </div>

            <div className="deity-inscription-fields">
              <label>
                <span className="deity-field-label">
                  <small>DIVINE NAME</small>
                  神名
                </span>
                <input
                  value={name}
                  minLength={2}
                  maxLength={30}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="例如：现金流守望者"
                  required
                />
              </label>
              <label>
                <span className="deity-field-label">
                  <small>DIVINE NATURE</small>
                  神格 · 提示词
                </span>
                <textarea
                  value={prompt}
                  minLength={20}
                  maxLength={2000}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="定义这位神明相信什么、拒绝什么、如何判断代价，以及会用怎样的声音降下神谕。"
                  required
                />
                <em>{prompt.length} / 2000</em>
              </label>
              <label className="gravity-field-toggle">
                <input
                  type="checkbox"
                  checked={randomEnabled}
                  onChange={(event) => setRandomEnabled(event.target.checked)}
                />
                <span aria-hidden="true">
                  <i />
                </span>
                <div>
                  <small>GRAVITY FIELD</small>
                  <strong>
                    {randomEnabled ? "位于引力场" : "暂离引力场"}
                  </strong>
                  <p>开启后，这位神明可能在未来的引力抽取中显形。</p>
                </div>
              </label>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}
          <footer>
            <button type="button" onClick={onClose} disabled={busy}>
              返回
            </button>
            <button className="forge-submit" type="submit" disabled={busy}>
              {busy
                ? "正在封存…"
                : deity
                  ? "封存新的神格"
                  : "完成造神"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
