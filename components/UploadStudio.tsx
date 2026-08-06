"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { createWatermarkedVariants } from "@/lib/watermark";
import AlarmCodeInput from "@/components/AlarmCodeInput";
import { normalizeTags } from "@/lib/types";
import type { Alarmcode } from "@/lib/types";

type SourceMedia = {
  id: string;
  file: string;
  file_preview: string | null;
  file_preview_watermarked: string | null;
  file_download_watermarked: string | null;
  display_name: string | null;
  tags: string[] | null;
};

type PostMode = "einsatz" | "stockfoto";

type ExistingPost = {
  id: string;
  post_type: PostMode;
  title: string | null;
  event_date: string | null;
  alarm_code: string | null;
  location: string | null;
  is_public: boolean;
  tags: string[];
  article_body: string | null;
};

export default function UploadStudio({
  watermarkText,
  existingTags,
  alarmcodes,
  sourceMedia,
}: {
  watermarkText: string;
  existingTags: string[];
  alarmcodes: Alarmcode[];
  sourceMedia: SourceMedia;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const existingPostId = searchParams.get("postId");

  const [existingPost, setExistingPost] = useState<ExistingPost | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(!!existingPostId);

  // Form-States (re-used für Neu + Bearbeiten)
  const [postMode, setPostMode] = useState<PostMode>("einsatz");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [alarmCode, setAlarmCode] = useState("");
  const [location, setLocation] = useState("");
  const [tags, setTags] = useState<string[]>(normalizeTags(sourceMedia.tags));
  const [tagInput, setTagInput] = useState("");
  const [caption, setCaption] = useState("");
  const [makePublic, setMakePublic] = useState(true);
  const [contentConfirmed, setContentConfirmed] = useState(false);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">(
    "idle"
  );
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  // UI-Lösch-Dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteWorking, setDeleteWorking] = useState(false);

  // Vorbefüllung, wenn ein bestehender Beitrag bearbeitet wird
  useEffect(() => {
    if (!existingPostId) return;

    let cancelled = false;

    async function loadExisting() {
      setLoadingExisting(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/intern/posts/detail?postId=${existingPostId}`
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.ok) {
          throw new Error(
            body.error || "Details konnten nicht geladen werden."
          );
        }
        if (cancelled) return;
        const p: ExistingPost = body.post;
        setExistingPost(p);
        setPostMode(p.post_type);
        setTitle(p.title || "");
        setEventDate(p.event_date || "");
        setAlarmCode(p.alarm_code || "");
        setLocation(p.location || "");
        setTags(p.tags || []);
        setCaption(body.images?.[0]?.caption || "");
        setMakePublic(p.is_public);
        setContentConfirmed(true); // bei Bearbeiten sinnvoll vorausgesetzt
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Details konnten nicht geladen werden."
        );
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    }

    loadExisting();

    return () => {
      cancelled = true;
    };
  }, [existingPostId, sourceMedia.id]);

  function addTag(v: string) {
    const t = v.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  async function handleTogglePublic(makePublicTarget: boolean) {
    if (!existingPost) return;
    try {
      setError(null);
      setProgress("Status wird geändert …");
      const res = await fetch("/api/intern/posts/toggle-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: existingPost.id,
          makePublic: makePublicTarget,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        throw new Error(body.error || "Statuswechsel fehlgeschlagen.");
      }
      setMakePublic(makePublicTarget);
      setExistingPost((prev) =>
        prev ? { ...prev, is_public: makePublicTarget } : prev
      );
      setProgress("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Statuswechsel fehlgeschlagen."
      );
      setProgress("");
    }
  }

  function handleDelete() {
    if (!existingPost) return;
    setShowDeleteDialog(true);
  }

  async function confirmDelete() {
    if (!existingPost || deleteWorking) return;
    setDeleteWorking(true);
    setError(null);
    try {
      setProgress("Beitrag wird gelöscht …");
      const res = await fetch("/api/intern/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existingPost.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.error) {
        throw new Error(body.error || "Löschen fehlgeschlagen.");
      }
      setStatus("done");
      setProgress("");
      setShowDeleteDialog(false);
      setDeleteWorking(false);
      router.push("/intern");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Löschen fehlgeschlagen."
      );
      setStatus("error");
      setProgress("");
      setShowDeleteDialog(false);
      setDeleteWorking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!contentConfirmed) {
      setError("Bitte die Bestätigung ankreuzen.");
      return;
    }
    if (
      postMode === "einsatz" &&
      (!title.trim() ||
        !location.trim() ||
        !alarmCode.trim() ||
        !eventDate)
    ) {
      setError(
        "Bitte Titel, Ort, Alarmcode und Datum ausfüllen."
      );
      return;
    }

    setStatus("working");

    const isEditMode = !!existingPost;

    try {
      const formData = new FormData();
      formData.append("source_media_id", sourceMedia.id);
      formData.append("post_type", postMode);
      formData.append("tags", tags.join(","));
      formData.append("make_public", String(makePublic));
      formData.append("content_confirmed", "true");
      formData.append("caption", caption);
      if (postMode === "einsatz") {
        formData.append("title", title);
        formData.append("event_date", eventDate);
        formData.append("alarm_code", alarmCode);
        formData.append("location", location);
      }

      const hasCached =
        !!(
          sourceMedia.file_preview_watermarked &&
          sourceMedia.file_download_watermarked
        );

      if (!hasCached) {
        setProgress("Wasserzeichen wird erzeugt …");
        const assetRes = await fetch(
          `/api/intern/library?original=${sourceMedia.id}`
        );
        if (!assetRes.ok)
          throw new Error(
            "Originalbild konnte nicht geladen werden."
          );
        const blob = await assetRes.blob();
        const file = new File(
          [blob],
          sourceMedia.display_name || "bild.jpg",
          { type: blob.type || "image/jpeg" }
        );
        const { preview, download } =
          await createWatermarkedVariants(file, watermarkText);
        formData.append("preview_0", preview, "preview.jpg");
        formData.append("download_0", download, "download.jpg");
      } else {
        formData.append("use_cached_watermark", "true");
      }

      if (isEditMode) {
        setProgress("Beitrag wird aktualisiert …");
        const res = await fetch("/api/intern/update", {
          method: "POST",
          body: formData,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.error) {
          throw new Error(
            body.error || "Aktualisieren fehlgeschlagen."
          );
        }
      } else {
        setProgress("Wird veröffentlicht …");
        const res = await fetch("/api/intern/upload", {
          method: "POST",
          body: formData,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body.error) {
          throw new Error(
            body.error || "Veröffentlichen fehlgeschlagen."
          );
        }
      }

      setStatus("done");
      setProgress("");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditMode
          ? "Aktualisieren fehlgeschlagen."
          : "Veröffentlichen fehlgeschlagen."
      );
      setStatus("error");
      setProgress("");
    }
  }

  const inp =
    "w-full rounded border border-line-strong bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-ink";
  const lbl =
    "mb-1 block text-[11.5px] font-medium text-ink-2";
  const label = sourceMedia.display_name || "Bild";

  if (loadingExisting) {
    return (
      <div className="rounded-[10px] border border-line bg-white p-8 text-center">
        <p className="text-[13px] text-ink-2">
          Bestehender Beitrag wird geladen …
        </p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="rounded-[10px] border border-line bg-white p-8 text-center">
        <h2 className="mb-1 font-display text-[20px] font-bold">
          {existingPost ? "Aktualisiert" : "Veröffentlicht"}
        </h2>
        <p className="mb-4 text-[13px] text-ink-2">
          {makePublic
            ? "Beitrag ist jetzt öffentlich."
            : "Als privat gespeichert."}
        </p>
        <button
          type="button"
          onClick={() => router.push("/intern")}
          className="rounded-md bg-ink px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90"
        >
          Zur Übersicht
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* Bild-Header */}
      <div className="flex items-center gap-3 rounded-[10px] border border-line bg-white p-3">
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-panel">
          <Image
            src={`/api/intern/library?original=${sourceMedia.id}&width=160&quality=70`}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">
            {label}
          </p>
          <p className="text-[11.5px] text-ink-2">
            Aus der Medienbibliothek
          </p>
        </div>
      </div>

      {/* Modus-Umschalter */}
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-semibold text-ink-2">
          Typ:
        </span>
        <div className="flex gap-1 rounded-md border border-line-strong bg-panel p-0.5">
          {(["einsatz", "stockfoto"] as PostMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setPostMode(mode)}
              className={`rounded px-3 py-1 text-[12px] font-semibold transition-colors ${
                postMode === mode
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-2 hover:text-ink"
              }`}
            >
              {mode === "einsatz" ? "Einsatz" : "Stockfoto"}
            </button>
          ))}
        </div>
      </div>

      {/* Einsatzdaten */}
      {postMode === "einsatz" && (
        <div className="rounded-[10px] border border-line bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
            Einsatzdaten
          </p>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Datum *</label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Alarmcode *</label>
              <AlarmCodeInput
                value={alarmCode}
                onChange={setAlarmCode}
                alarmcodes={alarmcodes}
              />
            </div>
          </div>
          <div className="mb-2">
            <label className={lbl}>Titel *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inp}
              placeholder="Zimmerbrand Hauptstraße"
            />
          </div>
          <div>
            <label className={lbl}>Ort *</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inp}
              placeholder="Musterstadt"
            />
          </div>
        </div>
      )}

      {/* Tags + Bildunterschrift + Optionen */}
      <div className="rounded-[10px] border border-line bg-white p-3">
        <div className="mb-2">
          <label className={lbl}>Tags</label>
          <div
            className="flex min-h-[32px] flex-wrap gap-1 rounded border border-line-strong bg-white px-2 py-1"
            onClick={() =>
              document.getElementById("tag-input")?.focus()
            }
          >
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-0.5 rounded-[3px] border border-line-strong bg-panel px-1.5 text-[11px]"
              >
                {tag}
                <button
                  type="button"
                  onClick={() =>
                    setTags((p) => p.filter((t) => t !== tag))
                  }
                  className="ml-0.5 leading-none text-ink-3 hover:text-ink"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              id="tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" ||
                  e.key === "," ||
                  e.key === " "
                ) {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              onBlur={() => {
                if (tagInput.trim()) addTag(tagInput);
              }}
              placeholder={tags.length === 0 ? "Tags …" : ""}
              list="tag-suggestions"
              className="min-w-[60px] flex-1 bg-transparent text-[12px] outline-none"
            />
            <datalist id="tag-suggestions">
              {existingTags
                .filter((t) => !tags.includes(t))
                .map((t) => (
                  <option key={t} value={t} />
                ))}
            </datalist>
          </div>
        </div>

        <div className="mb-3">
          <label className={lbl}>
            Bildunterschrift (optional)
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className={inp}
            placeholder="Kurze Beschreibung"
          />
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-2">
          <label className="flex cursor-pointer items-start gap-1.5 text-[11.5px] text-ink-2">
            <input
              type="checkbox"
              checked={contentConfirmed}
              onChange={(e) =>
                setContentConfirmed(e.target.checked)
              }
              className="mt-0.5 flex-shrink-0"
            />
            <span>
              Ich bestätige die Berechtigung zur Veröffentlichung. *
            </span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <div
              onClick={() => setMakePublic((v) => !v)}
              className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                makePublic ? "bg-ink" : "bg-line-strong"
              }`}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                  makePublic
                    ? "translate-x-4"
                    : "translate-x-0.5"
                }`}
              />
            </div>
            <span className="text-[12px] font_medium">
              {makePublic
                ? "Direkt öffentlich"
                : "Privat gespeichert"}
            </span>
          </label>
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-signal-deep">{error}</p>
      )}
      {progress && (
        <p className="text-[12px] text-ink-2">{progress}</p>
      )}

      {/* Haupt-Action + Admin-Actions im Edit-Mode */}
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={status === "working"}
          className="w-full rounded-md bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
        >
          {status === "working"
            ? existingPost
              ? "Wird aktualisiert …"
              : "Wird verarbeitet …"
            : existingPost
            ? "Aktualisieren"
            : "Veröffentlichen"}
        </button>

        {existingPost && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleTogglePublic(!makePublic)}
              className="rounded-md border border-line-strong bg-panel px-4 py-2 text-[12px] font-semibold text-ink hover:bg-line"
            >
              {makePublic ? "Privat schalten" : "Öffentlich schalten"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md border border-line-strong bg-white px-4 py-2 text-[12px] font-semibold text-signal-deep hover:bg-signal-light"
            >
              Löschen
            </button>
          </div>
        )}
      </div>

      {/* UI-Lösch-Dialog (Modal) */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-[10px] border border-line bg-white p-4">
            <h3 className="mb-2 font-display text-[18px] font-bold">
              Beitrag löschen?
            </h3>
            <p className="mb-4 text-[13px] text-ink-2">
              Diesen Beitrag inklusive Bilder wirklich löschen? Diese
              Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleteWorking}
                className="rounded-md border border-line-strong bg-panel px-4 py-2 text-[12px] font-semibold text-ink hover:bg-line disabled:opacity-60"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteWorking}
                className="rounded-md bg-signal-deep px-4 py-2 text-[12px] font-semibold text-white hover:bg-signal-deep/90 disabled:opacity-60"
              >
                {deleteWorking ? "Wird gelöscht …" : "Löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
