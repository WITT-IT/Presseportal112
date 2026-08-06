import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, SESSION_COOKIE } from "@/lib/auth";
import { DIRECTUS_URL } from "@/lib/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");

  if (!postId) {
    return NextResponse.json(
      { error: "postId fehlt." },
      { status: 400 }
    );
  }

  const token = session.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  try {
    // Beitrag inkl. Basis-Felder
    const postRes = await fetch(
      `${DIRECTUS_URL}/items/posts/${postId}?fields=id,organization,post_type,title,event_date,alarm_code,location,is_public,tags,article_body`,
      { headers }
    );

    if (!postRes.ok) {
      const text = await postRes.text().catch(() => "");
      console.error("[posts/detail] Beitrag nicht gefunden:", {
        status: postRes.status,
        body: text,
      });
      return NextResponse.json(
        { error: "Beitrag nicht gefunden." },
        { status: 404 }
      );
    }

    const { data: post } = await postRes.json();

    if (post.organization !== organizationId) {
      return NextResponse.json(
        { error: "Keine Berechtigung." },
        { status: 403 }
      );
    }

    // Zugehörige Bilder laden
    const imagesRes = await fetch(
      `${DIRECTUS_URL}/items/images?filter[post][_eq]=${postId}&fields=id,file_original,file_public_preview_watermarked,caption&limit=50`,
      { headers }
    );

    if (!imagesRes.ok) {
      const text = await imagesRes.text().catch(() => "");
      console.error("[posts/detail] Bilder konnten nicht geladen werden:", {
        status: imagesRes.status,
        body: text,
      });
      return NextResponse.json(
        { error: "Bilder konnten nicht geladen werden." },
        { status: 500 }
      );
    }

    const { data: images } = await imagesRes.json();

    return NextResponse.json({
      ok: true,
      post: {
        id: post.id,
        post_type: post.post_type,
        title: post.title ?? null,
        event_date: post.event_date ?? null,
        alarm_code: post.alarm_code ?? null,
        location: post.location ?? null,
        is_public: !!post.is_public,
        tags: Array.isArray(post.tags) ? post.tags : [],
        article_body: post.article_body ?? null,
      },
      images: images.map((img: any) => ({
        id: img.id,
        file_original: img.file_original,
        file_public_preview_watermarked: img.file_public_preview_watermarked,
        caption: img.caption ?? null,
      })),
    });
  } catch (error) {
    console.error("[posts/detail] Unerwarteter Fehler:", error);
    return NextResponse.json(
      { error: "Details konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}
