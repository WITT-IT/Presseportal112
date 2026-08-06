"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import UploadStudio from "@/components/UploadStudio";
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

export default function UploadStudioPage() {
  const searchParams = useSearchParams();
  const postId = searchParams.get("postId");

  const [watermarkText, setWatermarkText] = useState<string>("Presseportal112.de");
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [alarmcodes, setAlarmcodes] = useState<Alarmcode[]>([]);
  const [sourceMedia, setSourceMedia] = useState<SourceMedia | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setLoading(true);
      setError(null);
      try {
        // 1) Metadaten für Watermark, Tags, Alarmcodes laden
        const [tagsRes, alarmRes] = await Promise.all([
          fetch("/api/intern/tags").catch(() => null),
          fetch("/api/intern/alarmcodes").catch(() => null),
        ]);

        if (tagsRes && tagsRes.ok) {
          const tBody = await tagsRes.json().catch(() => ({}));
          setExistingTags(Array.isArray(tBody.tags) ? tBody.tags : []);
        }

        if (alarmRes && alarmRes.ok) {
          const aBody = await alarmRes.json().catch(() => ({}));
          setAlarmcodes(Array.isArray(aBody.alarmcodes) ? aBody.alarmcodes : []);
        }

        // 2) SourceMedia aus der Medienbibliothek (für dieses postId oder aus Query original)
        // Für den Anfang nehmen wir postId als Quelle: Du kannst hier deine eigene Logik einsetzen.
        if (!postId) {
          throw new Error("postId fehlt in der URL.");
        }

        const mediaRes = await fetch(
          `/api/intern/library?from_post=${postId}`
        ).catch(() => null);

        if (!mediaRes || !mediaRes.ok) {
          throw new Error("Medienbibliothek-Eintrag konnte nicht geladen werden.");
        }

        const mBody = await mediaRes.json().catch(() => ({}));
        if (!mBody || !mBody.sourceMedia) {
          throw new Error("Kein Medienbibliothek-Eintrag gefunden.");
        }

        if (cancelled) return;
        setSourceMedia(mBody.sourceMedia);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "UploadStudio konnte nicht geladen werden."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitial();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-[13px] text-ink-2">UploadStudio wird vorbereitet …</p>
      </div>
    );
  }

  if (error || !sourceMedia) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <p className="text-[13px] text-signal-deep">
          {error || "UploadStudio konnte nicht geladen werden."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <UploadStudio
        watermarkText={watermarkText}
        existingTags={existingTags}
        alarmcodes={alarmcodes}
        sourceMedia={sourceMedia}
      />
    </div>
  );
}
