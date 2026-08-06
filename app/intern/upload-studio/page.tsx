import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getCurrentUser } from "@/lib/auth";
import { DIRECTUS_URL } from "@/lib/directus";
import UploadStudio from "@/components/UploadStudio";

export const dynamic = "force-dynamic";

export default async function UploadStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ postId?: string }>;
}) {
  const { postId } = await searchParams;

  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) redirect("/login");

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    redirect("/login");
  }

  const token = session.accessToken;
  const headers = { Authorization: `Bearer ${token}` };

  // User + Org
  const user = await getCurrentUser(token);
  if (!user) redirect("/login");

  const organizationId = user?.organization?.id as string | undefined;
  if (!organizationId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 font-display text-[24px] font-bold">Studio</h1>
        <p className="text-[13px] text-signal-deep">
          Deinem Konto ist keine Organisation zugeordnet. Bitte melde dich mit einem anderen Account oder kontaktiere den Support.
        </p>
      </div>
    );
  }

  // Tags
  const tagsRes = await fetch(
    `${DIRECTUS_URL}/items/tags?filter[organization][_eq]=${organizationId}&fields=id,slug&limit=200`,
    { headers }
  );
  const tagsData = await tagsRes.json().catch(() => ({ data: [] }));
  const existingTags = (tagsData.data ?? []).map((t: any) => t.slug);

  // Alarmcodes
  const alarmcodesRes = await fetch(
    `${DIRECTUS_URL}/items/alarmcodes?filter[organization][_eq]=${organizationId}&fields=id,code,title&sort=code`,
    { headers }
  );
  const alarmcodesData = await alarmcodesRes.json().catch(() => ({ data: [] }));
  const alarmcodes = (alarmcodesData.data ?? []).map((t: any) => ({
    id: t.id,
    code: t.code,
    title: t.title,
  }));

  // Beitrag + Bilder (falls postId)
  let sourceMedia: {
    id: string;
    file: string;
    file_preview: string | null;
    file_preview_watermarked: string | null;
    file_download_watermarked: string | null;
    display_name: string | null;
    tags: string[] | null;
  } | null = null;

  if (postId) {
    try {
      const postRes = await fetch(
        `${DIRECTUS_URL}/items/posts/${postId}?fields=id,organization,post_type,title,event_date,alarm_code,location,is_public,tags,article_body,images.id,images.file_original,images.file_public_preview_watermarked,images.caption`,
        { headers }
      );
      if (!postRes.ok) throw new Error("Beitrag konnte nicht geladen werden.");
      const { data: post } = await postRes.json();
      if (post.organization !== organizationId) {
        throw new Error("Keine Berechtigung für diesen Beitrag.");
      }
      const images = post.images ?? [];
      const mainImage = images[0] ?? null;
      if (mainImage) {
        sourceMedia = {
          id: mainImage.id,
          file: mainImage.file_original,
          file_preview: mainImage.file_public_preview_watermarked ?? null,
          file_preview_watermarked: mainImage.file_public_preview_watermarked ?? null,
          file_download_watermarked: mainImage.file_public_preview_watermarked ?? null,
          display_name: mainImage.caption ?? null,
          tags: post.tags ?? [],
        };
      }
    } catch (err) {
      console.error("[upload-studio] Fehler beim Laden des Beitrags:", err);
    }
  }

  if (!sourceMedia) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 font-display text-[24px] font-bold">Studio</h1>
        <p className="text-[13px] text-ink-2">
          Kein gültiger Beitrag gefunden. Bitte über die Übersicht öffnen.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 font-display text-[24px] font-bold">Studio</h1>
      <UploadStudio
        watermarkText="Presseportal112"
        existingTags={existingTags}
        alarmcodes={alarmcodes}
        sourceMedia={sourceMedia}
      />
    </div>
  );
}
