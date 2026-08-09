import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { DIRECTUS_URL } from "@/lib/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchJSON(label: string, url: string, token: string) {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[dashboard] Directus-Request fehlgeschlagen:", {
        label,
        url,
        status: res.status,
        body: text,
      });
      throw new Error(`Directus request failed (${res.status})`);
    }
    return res.json();
  } catch (error) {
    console.error("[dashboard] Netzwerk-/Parsefehler:", { label, url, error });
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Sitzung ungültig." }, { status: 401 });
  }

  const user = await getCurrentUser(session.accessToken);
  const organizationId = user?.organization?.id;
  if (!organizationId) {
    return NextResponse.json({ error: "Keine Organisation." }, { status: 403 });
  }

  const urlObj = new URL(request.url);
  const publicPage = Number(urlObj.searchParams.get("publicPage") || "1");
  const privatePage = Number(urlObj.searchParams.get("privatePage") || "1");
  const pageSize = Number(urlObj.searchParams.get("pageSize") || "12");

  const token = session.accessToken;

  try {
    const [statsPublic, statsPrivate, statsShares, publicPosts, privatePosts] =
      await Promise.all([
        // meta=* ergänzt -- ohne das liefert Directus keine "meta"-Hülle
        // in der Antwort, wodurch statsPublic?.meta?.aggregate immer
        // undefined war und der Code lautlos auf 0 zurückgefallen ist.
        // Genau das war der Grund, warum die Dashboard-Kacheln immer 0
        // zeigten, egal wie viele Beiträge tatsächlich existierten.
        fetchJSON(
          "statsPublic",
          `${DIRECTUS_URL}/items/posts?filter[organization][_eq]=${organizationId}&filter[is_public][_eq]=true&aggregate[count]=id&meta=*`,
          token
        ),
        fetchJSON(
          "statsPrivate",
          `${DIRECTUS_URL}/items/posts?filter[organization][_eq]=${organizationId}&filter[is_public][_eq]=false&aggregate[count]=id&meta=*`,
          token
        ),
        fetchJSON(
          "statsShares",
          `${DIRECTUS_URL}/items/media_shares?filter[organization][_eq]=${organizationId}&filter[expires_at][_gte]=${new Date().toISOString()}&aggregate[count]=id&meta=*`,
          token
        ),
        // Öffentliche Beiträge: sortiert nach published_at
        fetchJSON(
          "publicPosts",
          `${DIRECTUS_URL}/items/posts?filter[organization][_eq]=${organizationId}&filter[is_public][_eq]=true&limit=${pageSize}&page=${publicPage}&sort[]=-published_at&meta=filter_count&fields[]=id&fields[]=post_type&fields[]=title&fields[]=event_date&fields[]=alarm_code&fields[]=location&fields[]=is_public&fields[]=published_at&fields[]=tags&fields[]=images.id&fields[]=images.caption&fields[]=images.file_public_preview_watermarked`,
          token
        ),
        // Private Beiträge: published_at ist bei Privaten immer null
        // (siehe Publish-Route), Sortierung danach ergibt keinen sinnvollen
        // Wert -- stattdessen nach event_date sortieren.
        fetchJSON(
          "privatePosts",
          `${DIRECTUS_URL}/items/posts?filter[organization][_eq]=${organizationId}&filter[is_public][_eq]=false&limit=${pageSize}&page=${privatePage}&sort[]=-event_date&meta=filter_count&fields[]=id&fields[]=post_type&fields[]=title&fields[]=event_date&fields[]=alarm_code&fields[]=location&fields[]=is_public&fields[]=published_at&fields[]=tags&fields[]=images.id&fields[]=images.caption&fields[]=images.file_public_preview_watermarked`,
          token
        ),
      ]);

    const publicCount = statsPublic?.meta?.aggregate?.[0]?.count?.id || 0;
    const privateCount = statsPrivate?.meta?.aggregate?.[0]?.count?.id || 0;
    const activeShares = statsShares?.meta?.aggregate?.[0]?.count?.id || 0;

    // totalUploads vorläufig als Summe der Beiträge
    const totalUploads = publicCount + privateCount;

    const mapPosts = (collection: any) => {
      const items = collection?.data || [];
      return items.map((post: any) => {
        const mainImage =
          Array.isArray(post.images) && post.images.length > 0
            ? post.images[0]
            : null;
        return {
          postId: post.id,
          postType: post.post_type,
          title: post.title ?? null,
          eventDate: post.event_date ?? null,
          alarmCode: post.alarm_code ?? null,
          location: post.location ?? null,
          isPublic: !!post.is_public,
          publishedAt: post.published_at ?? null,
          mainImage: mainImage
            ? {
                imageId: mainImage.id,
                thumbnailUrl: mainImage.file_public_preview_watermarked
                  ? `${DIRECTUS_URL}/assets/${mainImage.file_public_preview_watermarked}?width=300&quality=70`
                  : null,
                caption: mainImage.caption ?? null,
              }
            : null,
          tags: Array.isArray(post.tags) ? post.tags : [],
          shareCount: 0,
        };
      });
    };

    const publicItems = mapPosts(publicPosts);
    const privateItems = mapPosts(privatePosts);

    // pageCount gibt's in Directus' meta-Objekt nicht direkt -- aus
    // filter_count selbst berechnen (war vorher schon auf einen nicht
    // existierenden Pfad "meta.pageCount" verwiesen, der ebenfalls immer
    // undefined war und lautlos auf 1 zurückfiel).
    const publicFilterCount = publicPosts?.meta?.filter_count ?? publicCount;
    const privateFilterCount = privatePosts?.meta?.filter_count ?? privateCount;
    const publicTotalPages = Math.max(1, Math.ceil(publicFilterCount / pageSize));
    const privateTotalPages = Math.max(1, Math.ceil(privateFilterCount / pageSize));

    return NextResponse.json({
      stats: {
        totalUploads,
        publicPosts: publicCount,
        privatePosts: privateCount,
        activeShares,
      },
      publicItems,
      privateItems,
      pagination: {
        publicPage,
        publicTotalPages,
        privatePage,
        privateTotalPages,
        pageSize,
      },
    });
  } catch (error) {
    console.error(
      "[dashboard] Fehler beim Laden der Übersicht (gesamt):",
      error
    );
    return NextResponse.json(
      { error: "Übersicht konnte nicht geladen werden." },
      { status: 500 }
    );
  }
}
