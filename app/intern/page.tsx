"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface DashboardStats {
  totalUploads: number;
  publicPosts: number;
  privatePosts: number;
  activeShares: number;
}

interface DashboardItemImage {
  imageId: string;
  thumbnailUrl: string | null;
  caption: string | null;
}

interface DashboardItem {
  postId: string;
  postType: "einsatz" | "stockfoto" | string;
  title: string | null;
  eventDate: string | null;
  alarmCode: string | null;
  location: string | null;
  isPublic: boolean;
  publishedAt: string | null;
  mainImage: DashboardItemImage | null;
  tags: string[];
  shareCount: number;
}

interface DashboardResponse {
  stats: DashboardStats;
  publicItems: DashboardItem[];
  privateItems: DashboardItem[];
  pagination: {
    publicPage: number;
    publicTotalPages: number;
    privatePage: number;
    privateTotalPages: number;
    pageSize: number;
  };
}

type Tile = {
  label: string;
  value: number;
};

export default function InternPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [publicItems, setPublicItems] = useState<DashboardItem[]>([]);
  const [privateItems, setPrivateItems] = useState<DashboardItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/intern/dashboard");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Übersicht konnte nicht geladen werden.");
        }
        const data: DashboardResponse = await res.json();
        if (cancelled) return;
        setStats(data.stats);
        setPublicItems(data.publicItems);
        setPrivateItems(data.privateItems);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Übersicht konnte nicht geladen werden."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  async function togglePublic(postId: string, makePublic: boolean) {
    try {
      const res = await fetch("/api/intern/posts/toggle-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, makePublic }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        throw new Error(body.error || "Statuswechsel fehlgeschlagen.");
      }

      // Optimistisch zwischen den Listen verschieben
      if (makePublic) {
        setPrivateItems((prevPrivate) => {
          const moved = prevPrivate.find((item) => item.postId === postId);
          const restPrivate = prevPrivate.filter((item) => item.postId !== postId);
          if (!moved) return prevPrivate;
          setPublicItems((prevPublic) => [
            { ...moved, isPublic: true },
            ...prevPublic.filter((i) => i.postId !== postId),
          ]);
          return restPrivate;
        });
      } else {
        setPublicItems((prevPublic) => {
          const moved = prevPublic.find((item) => item.postId === postId);
          const restPublic = prevPublic.filter((item) => item.postId !== postId);
          if (!moved) return prevPublic;
          setPrivateItems((prevPrivate) => [
            { ...moved, isPublic: false },
            ...prevPrivate.filter((i) => i.postId !== postId),
          ]);
          return restPublic;
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Statuswechsel fehlgeschlagen."
      );
    }
  }

  const tiles: Tile[] = [
    {
      label: "Uploads gesamt",
      value: stats?.totalUploads ?? 0,
    },
    {
      label: "Öffentlich",
      value: stats?.publicPosts ?? 0,
    },
    {
      label: "Privat",
      value: stats?.privatePosts ?? 0,
    },
    {
      label: "Aktive Freigaben",
      value: stats?.activeShares ?? 0,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="mb-2 font-display text-[28px] font-bold">
          Willkommen
        </h1>
      </header>

      {/* Einfache Statistik-Zeile statt Banner */}
      <div className="mb-6 grid grid-cols-2 gap-3 nav:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-[10px] border border-line bg-white px-3 py-2"
          >
            <div className="text-[11.5px] font-semibold text-ink-3">
              {tile.label}
            </div>
            <div className="mt-1 text-[18px] font-bold text-ink">
              {tile.value.toLocaleString("de-DE")}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-4 text-[13px] text-signal-deep">{error}</p>
      )}

      {loading && !error && (
        <p className="mt-4 text-[13px] text-ink-2">
          Übersicht wird geladen …
        </p>
      )}

      {!loading && !error && (
        <div className="mt-8 flex flex-col gap-8">
          {/* Öffentliche Beiträge/Bilder */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[18px] font-bold">
                Öffentlich
              </h2>
              <span className="text-[12px] text-ink-3">
                {publicItems.length} Beiträge/Bilder
              </span>
            </div>
            {publicItems.length === 0 ? (
              <p className="text-[13px] text-ink-2">
                Noch keine öffentlichen Inhalte.
              </p>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 nav:grid-cols-3">
                {publicItems.map((item) => (
                  <article
                    key={item.postId}
                    className="group flex flex-col overflow-hidden rounded-[10px] border border-line bg-white"
                  >
                    {item.mainImage && item.mainImage.thumbnailUrl && (
                      <div className="relative h-40 w-full bg-panel">
                        <Image
                          src={item.mainImage.thumbnailUrl}
                          alt={item.mainImage.caption || ""}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <span className="absolute left-2 top-2 rounded-[4px] bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">
                          Öffentlich
                        </span>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <div>
                        <p className="text-[13px] font-semibold text-ink">
                          {item.postType === "einsatz"
                            ? item.title || "Einsatz"
                            : "Stockfoto"}
                        </p>
                        {item.postType === "einsatz" && (
                          <p className="text-[11.5px] text-ink-2">
                            {item.eventDate} · {item.alarmCode} ·{" "}
                            {item.location}
                          </p>
                        )}
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            togglePublic(item.postId, false)
                          }
                          className="rounded-md border border-line-strong bg-panel px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-line"
                        >
                          Privat schalten
                        </button>
                        <Link
                          href={`/intern/upload?postId=${item.postId}`}
                          className="text-[12px] font-semibold text-ink hover:underline"
                        >
                          Bearbeiten
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Private Beiträge/Bilder */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[18px] font-bold">
                Privat
              </h2>
              <span className="text-[12px] text-ink-3">
                {privateItems.length} Beiträge/Bilder
              </span>
            </div>
            {privateItems.length === 0 ? (
              <p className="text-[13px] text-ink-2">
                Noch keine privaten Inhalte.
              </p>
            ) : (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 nav:grid-cols-3">
                {privateItems.map((item) => (
                  <article
                    key={item.postId}
                    className="group flex flex-col overflow-hidden rounded-[10px] border border-line bg-white"
                  >
                    {item.mainImage && item.mainImage.thumbnailUrl && (
                      <div className="relative h-40 w-full bg-panel">
                        <Image
                          src={item.mainImage.thumbnailUrl}
                          alt={item.mainImage.caption || ""}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <span className="absolute left-2 top-2 rounded-[4px] bg-ink px-2 py-0.5 text-[11px] font-semibold text-white">
                          Privat
                        </span>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <div>
                        <p className="text-[13px] font-semibold text-ink">
                          {item.postType === "einsatz"
                            ? item.title || "Einsatz"
                            : "Stockfoto"}
                        </p>
                        {item.postType === "einsatz" && (
                          <p className="text-[11.5px] text-ink-2">
                            {item.eventDate} · {item.alarmCode} ·{" "}
                            {item.location}
                          </p>
                        )}
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            togglePublic(item.postId, true)
                          }
                          className="rounded-md border border-line-strong bg-ink px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-black"
                        >
                          Öffentlich schalten
                        </button>
                        <Link
                          href={`/intern/upload?postId=${item.postId}`}
                          className="text-[12px] font-semibold text-ink hover:underline"
                        >
                          Bearbeiten
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
