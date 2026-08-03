'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { directusAssetUrl } from '@/lib/directus';
import { GEWERK_ICONS } from '@/lib/types';

type OrgData = {
  id: string;
  name: string;
  gewerk: string;
  description: string | null;
  website: string | null;
  social_links: Record<string, string> | null;
  show_website: boolean;
  show_social_links: boolean;
  logo: string | null;
};

export default function OrgProfileEditor({
  org,
  gewerkName,
  gewerkColor,
  canEdit,
}: {
  org: OrgData;
  gewerkName: string;
  gewerkColor: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState(org.description ?? '');
  const [website, setWebsite] = useState(org.website ?? '');
  const [facebook, setFacebook] = useState(org.social_links?.facebook ?? '');
  const [instagram, setInstagram] = useState(org.social_links?.instagram ?? '');
  const [otherSocial, setOtherSocial] = useState(org.social_links?.sonstiges ?? '');
  const [showWebsite, setShowWebsite] = useState(org.show_website);
  const [showSocialLinks, setShowSocialLinks] = useState(org.show_social_links);
  const [imageUploading, setImageUploading] = useState<'logo' | 'banner_image' | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/organisationen/${org.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: description || null,
        website: website || null,
        social_links: { facebook, instagram, sonstiges: otherSocial },
        show_website: showWebsite,
        show_social_links: showSocialLinks,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Speichern fehlgeschlagen.');
    }
  }

  async function handleImageChange(field: 'logo' | 'banner_image', e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(field);
    setError(null);
    const formData = new FormData();
    formData.append('field', field);
    formData.append('file', file);
    const res = await fetch(`/api/organisationen/${org.id}/image`, {
      method: 'POST',
      body: formData,
    });
    setImageUploading(null);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Hochladen fehlgeschlagen.');
    }
    e.target.value = '';
  }

  const hasVisibleLinks =
    (org.show_website && org.website) ||
    (org.show_social_links && org.social_links && Object.keys(org.social_links).length > 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.06]">
            {org.logo ? (
              <Image
                src={directusAssetUrl(org.logo, 'width=112&quality=80')}
                alt=""
                fill
                className="object-cover"
              />
            ) : (
              <i
                className={`ti ${GEWERK_ICONS[org.gewerk] ?? 'ti-shield'} text-[26px]`}
                style={{ color: gewerkColor }}
                aria-hidden="true"
              />
            )}
            {canEdit && editing && (
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={imageUploading === 'logo'}
                className="absolute inset-0 flex items-center justify-center bg-void/70 text-[9.5px] font-semibold text-white transition-opacity hover:bg-void/80"
              >
                {imageUploading === 'logo' ? '…' : 'Logo ändern'}
              </button>
            )}
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleImageChange('logo', e)}
            className="hidden"
          />

          <div>
            <div className="mb-1 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-amber">
              {gewerkName}
            </div>
            <h1 className="font-display text-[clamp(28px,4vw,42px)] font-bold leading-[1.02] text-white">
              {org.name}
            </h1>
          </div>
        </div>

        <div className="flex gap-2">
          {canEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3.5 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:border-white/40"
            >
              <i className="ti ti-edit text-[13px]" aria-hidden="true" />
              Seite bearbeiten
            </button>
          )}
          <a
            href={`/kontakt?org=${org.id}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/20 px-3.5 py-2.5 text-[12.5px] font-semibold text-white transition-colors hover:border-white/40"
          >
            <i className="ti ti-mail text-[13px]" aria-hidden="true" />
            Kontakt aufnehmen
          </a>
        </div>
      </div>

      {!editing && (
        <>
          {org.description && (
            <p className="mt-5 max-w-[640px] text-[14px] leading-[1.6] text-white/70">
              {org.description}
            </p>
          )}
          {hasVisibleLinks && (
            <div className="mt-4 flex flex-wrap gap-4">
              {org.show_website && org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12.5px] font-medium text-white/70 hover:text-white"
                >
                  <i className="ti ti-world text-[14px]" aria-hidden="true" />
                  Website
                </a>
              )}
              {org.show_social_links &&
                org.social_links &&
                Object.entries(org.social_links).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12.5px] font-medium capitalize text-white/70 hover:text-white"
                  >
                    <i className="ti ti-link text-[14px]" aria-hidden="true" />
                    {platform}
                  </a>
                ))}
            </div>
          )}
        </>
      )}

      {canEdit && editing && (
        <div className="mt-6 rounded-[10px] border border-white/15 bg-white/[0.04] p-5">
          <div className="mb-4">
            <label className="mb-1.5 block text-[12px] font-medium text-white/70">
              Kurzbeschreibung
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Kurz, was eure Organisation macht …"
              className="w-full rounded-md border border-white/20 bg-white/[0.06] px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-white/40"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 flex items-center gap-2 text-[12.5px] text-white/80">
              <input
                type="checkbox"
                checked={showWebsite}
                onChange={(e) => setShowWebsite(e.target.checked)}
              />
              Website öffentlich zeigen
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-md border border-white/20 bg-white/[0.06] px-3 py-2 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-white/40"
            />
          </div>

          <div className="mb-4">
            <label className="mb-2 flex items-center gap-2 text-[12.5px] text-white/80">
              <input
                type="checkbox"
                checked={showSocialLinks}
                onChange={(e) => setShowSocialLinks(e.target.checked)}
              />
              Social-Media-Links öffentlich zeigen
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="url"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="Facebook"
                className="rounded-md border border-white/20 bg-white/[0.06] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/40"
              />
              <input
                type="url"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="Instagram"
                className="rounded-md border border-white/20 bg-white/[0.06] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/40"
              />
            </div>
            <input
              type="url"
              value={otherSocial}
              onChange={(e) => setOtherSocial(e.target.value)}
              placeholder="Weiterer Link (X, YouTube, TikTok …)"
              className="mt-2 w-full rounded-md border border-white/20 bg-white/[0.06] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/30 focus:border-white/40"
            />
          </div>

          <div className="mb-4">
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleImageChange('banner_image', e)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={imageUploading === 'banner_image'}
              className="flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:border-white/40 disabled:opacity-50"
            >
              <i className="ti ti-photo text-[14px]" aria-hidden="true" />
              {imageUploading === 'banner_image' ? 'Wird hochgeladen …' : 'Titelbild ändern'}
            </button>
          </div>

          {error && <p className="mb-3 text-[12px] text-signal">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-white/20 px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:border-white/40"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-white px-4 py-2 text-[12.5px] font-semibold text-void transition-colors hover:bg-white/90 disabled:opacity-60"
            >
              {saving ? 'Wird gespeichert …' : 'Speichern'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
