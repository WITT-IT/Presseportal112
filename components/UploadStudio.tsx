'use client';

import { useState, useRef, useCallback, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createWatermarkedVariants } from '@/lib/watermark';
import AlarmCodeInput from '@/components/AlarmCodeInput';
import RichTextEditor from '@/components/RichTextEditor';
import { directusAssetUrl } from '@/lib/directus';
import type { Alarmcode, MediaLibraryItem } from '@/lib/types';

const MAX_FILE_SIZE = 80 * 1024 * 1024;
const MAX_IMAGES = 12;
const NEW_FOLDER_VALUE = '__new__';

type FolderOption = {
  id: string;
  name: string;
  is_system_folder?: boolean;
  system_role?: 'public' | 'unsorted' | null;
  postCount?: number;
  coverImage?: string | null;
};

type SelectedImage = {
  source: 'file' | 'library';
  file?: File;
  libraryId?: string;
  previewUrl: string;
  caption: string;
};

type PostMode = 'einsatz' | 'stockfoto';
type SourceTab = 'neu' | 'bibliothek' | 'ordner';

export default function UploadStudio({
  watermarkText,
  existingTags,
  alarmcodes,
  folders,
  preselectedFolderId = null,
}: {
  watermarkText: string;
  existingTags: string[];
  alarmcodes: Alarmcode[];
  folders: FolderOption[];
  preselectedFolderId?: string | null;
}) {
  const router = useRouter();

  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [sourceTab, setSourceTab] = useState<SourceTab>('neu');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [libraryItems, setLibraryItems] = useState<MediaLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');

  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [folderPosts, setFolderPosts] = useState<{
    id: string;
    title: string | null;
    images: { file_public_preview: string | null; sort: number }[];
  }[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);

  const [postMode, setPostMode] = useState<PostMode>('einsatz');
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [alarmCode, setAlarmCode] = useState('');
  const [location, setLocation] = useState('');
  const [articleBody, setArticleBody] = useState('');

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [folderChoice, setFolderChoice] = useState(preselectedFolderId ?? '');
  const [newFolderName, setNewFolderName] = useState('');
  const [makePublic, setMakePublic] = useState(false);
  const [contentConfirmed, setContentConfirmed] = useState(false);

  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadLibrary = useCallback(async (q = '') => {
    setLibraryLoading(true);
    try {
      const res = await fetch(`/api/intern/library?q=${encodeURIComponent(q)}&limit=48`);
      if (res.ok) {
        const data = await res.json();
        setLibraryItems(data.items || []);
      }
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  function handleSourceTab(tab: SourceTab) {
    setSourceTab(tab);
    if (tab === 'bibliothek' && libraryItems.length === 0) loadLibrary('');
  }

  async function openFolder(folderId: string) {
    setOpenFolderId(folderId);
    setFolderLoading(true);
    try {
      const res = await fetch(`/api/intern/folders/${folderId}/posts`);
      if (res.ok) {
        const data = await res.json();
        setFolderPosts(data.posts || []);
      }
    } finally {
      setFolderLoading(false);
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const tooBig = files.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) { setError(`"${tooBig.name}" ist größer als 80 MB.`); return; }
    const newImages: SelectedImage[] = files.map((f) => ({
      source: 'file',
      file: f,
      previewUrl: URL.createObjectURL(f),
      caption: '',
    }));
    setSelectedImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES));
    if (e.target) e.target.value = '';
    setError(null);
  }

  function toggleLibraryItem(item: MediaLibraryItem) {
    const exists = selectedImages.findIndex((s) => s.libraryId === item.id);
    if (exists >= 0) {
      setSelectedImages((prev) => prev.filter((_, i) => i !== exists));
    } else if (selectedImages.length < MAX_IMAGES) {
      setSelectedImages((prev) => [
        ...prev,
        {
          source: 'library',
          libraryId: item.id,
          previewUrl: item.file_preview
            ? directusAssetUrl(item.file_preview, 'width=200&quality=70')
            : '',
          caption: '',
        },
      ]);
    }
  }

  function removeSelected(index: number) {
    setSelectedImages((prev) => {
      const copy = [...prev];
      if (copy[index].source === 'file' && copy[index].previewUrl) {
        URL.revokeObjectURL(copy[index].previewUrl);
      }
      copy.splice(index, 1);
      return copy;
    });
  }

  function addTag(value: string) {
    const v = value.trim();
    if (v && !tags.includes(v)) setTags((prev) => [...prev, v]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedImages.length === 0) { setError('Bitte mindestens ein Foto auswählen.'); return; }
    if (!contentConfirmed) { setError('Bitte die Bestätigung ankreuzen.'); return; }
    if (postMode === 'einsatz' && (!title.trim() || !location.trim() || !alarmCode.trim() || !eventDate)) {
      setError('Bitte Titel, Ort, Alarmcode und Datum ausfüllen.');
      return;
    }
    if (folderChoice === NEW_FOLDER_VALUE && !newFolderName.trim()) {
      setError('Bitte einen Ordnernamen eingeben.');
      return;
    }

    setStatus('working');

    try {
      let targetFolderId = folderChoice === NEW_FOLDER_VALUE ? '' : folderChoice;
      if (folderChoice === NEW_FOLDER_VALUE) {
        setProgress('Ordner wird angelegt …');
        const folderRes = await fetch('/api/intern/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newFolderName.trim() }),
        });
        if (!folderRes.ok) throw new Error('Ordner konnte nicht angelegt werden.');
        const fd = await folderRes.json();
        targetFolderId = fd.id;
      }

      const formData = new FormData();
      formData.append('post_type', postMode);
      formData.append('tags', tags.join(','));
      formData.append('make_public', String(makePublic));
      formData.append('folder_id', targetFolderId);
      formData.append('content_confirmed', 'true');
      formData.append('image_count', String(selectedImages.length));

      if (postMode === 'einsatz') {
        formData.append('title', title);
        formData.append('event_date', eventDate);
        formData.append('alarm_code', alarmCode);
        formData.append('location', location);
        formData.append('article_body', articleBody);
      }

      for (let i = 0; i < selectedImages.length; i++) {
        const img = selectedImages[i];
        if (img.source === 'file' && img.file) {
          setProgress(`Wasserzeichen ${i + 1}/${selectedImages.length} …`);

          // Original als ArrayBuffer klonen BEVOR createWatermarkedVariants
          // das File-Objekt via loadImage/revokeObjectURL konsumiert.
          // Danach ist das File nicht mehr als Stream lesbar.
          const originalBuffer = await img.file.arrayBuffer();
          const originalBlob = new Blob([originalBuffer], { type: img.file.type });

          const { preview, download } = await createWatermarkedVariants(img.file, watermarkText);

          formData.append(`original_${i}`, originalBlob, img.file.name);
          formData.append(`preview_${i}`, preview, `prev-${img.file.name}.jpg`);
          formData.append(`download_${i}`, download, `dl-${img.file.name}.jpg`);
          formData.append(`caption_${i}`, img.caption);
        } else if (img.source === 'library' && img.libraryId) {
          formData.append(`library_id_${i}`, img.libraryId);
          formData.append(`caption_${i}`, img.caption);
        }
      }

      setProgress('Wird hochgeladen …');
      const res = await fetch('/api/intern/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Upload fehlgeschlagen.');
      }

      selectedImages.forEach((img) => {
        if (img.source === 'file' && img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
      setSelectedImages([]);
      setTitle(''); setEventDate(''); setAlarmCode('');
      setLocation(''); setArticleBody(''); setTags([]);
      setMakePublic(false); setContentConfirmed(false);
      setFolderChoice(preselectedFolderId ?? '');

      if (preselectedFolderId) {
        router.push(`/intern/ordner/${preselectedFolderId}`);
        router.refresh();
        return;
      }

      setStatus('done');
      setProgress('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fehlgeschlagen.');
      setStatus('error');
      setProgress('');
    }
  }

  const fieldClass = 'w-full rounded-md border border-line-strong px-3 py-2 text-[14px] outline-none focus:border-ink bg-white';
  const labelClass = 'mb-1.5 block text-[12.5px] font-medium text-ink-2';
  const selectableFolders = folders.filter((f) => !f.is_system_folder);

  if (status === 'done') {
    return (
      <div className="rounded-[10px] border border-line bg-white p-10 text-center">
        <i className="ti ti-circle-check mb-3 block text-[36px] text-ink" aria-hidden="true" />
        <h2 className="mb-2 font-display text-[22px] font-bold">Hochgeladen</h2>
        <p className="text-[13.5px] text-ink-2">
          {makePublic ? 'Beitrag ist jetzt öffentlich sichtbar.' : 'Als Entwurf gespeichert — noch nicht öffentlich.'}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-6 nav:grid-cols-[1fr_360px]">

        {/* ── LINKE SPALTE: Bildauswahl ── */}
        <div className="flex flex-col rounded-[10px] border border-line bg-white overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="text-[12.5px] font-semibold text-ink-2">Bilder</span>
            <div className="flex gap-1 rounded-md border border-line-strong bg-panel p-0.5">
              {(['neu', 'bibliothek', 'ordner'] as SourceTab[]).map((tab) => (
                <button key={tab} type="button" onClick={() => handleSourceTab(tab)}
                  className={`rounded px-3 py-1.5 text-[12px] font-semibold transition-colors ${sourceTab === tab ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
                  {tab === 'neu' ? 'Neu hochladen' : tab === 'bibliothek' ? 'Bibliothek' : 'Aus Ordner'}
                </button>
              ))}
            </div>
            <span className="ml-auto rounded-[4px] border border-line-strong bg-panel px-2 py-0.5 font-mono text-[11px] text-ink-2">
              {selectedImages.length} gewählt
            </span>
          </div>

          {/* Neu hochladen */}
          {sourceTab === 'neu' && (
            <div className="flex flex-1 flex-col p-4">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-3 rounded-md border-2 border-dashed border-line-strong py-4 text-ink-2 transition-colors hover:border-ink hover:text-ink">
                <i className="ti ti-cloud-upload text-[18px]" aria-hidden="true" />
                <span className="text-[13px] font-semibold">Fotos hierher ziehen oder klicken</span>
                <span className="text-[11px] text-ink-3">JPEG · PNG · WebP · max. 80 MB</span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
                multiple onChange={handleFileInput} className="hidden" />
            </div>
          )}

          {/* Bibliothek */}
          {sourceTab === 'bibliothek' && (
            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <i className="ti ti-search text-[14px] text-ink-3" aria-hidden="true" />
                <input type="text" value={libraryQuery}
                  onChange={(e) => { setLibraryQuery(e.target.value); loadLibrary(e.target.value); }}
                  placeholder="Tags oder Dateiname …" className="flex-1 bg-transparent text-[13px] outline-none" />
              </div>
              <div className="grid grid-cols-4 gap-2 p-3 flex-1 content-start">
                {libraryLoading ? (
                  <p className="col-span-4 py-8 text-center text-[12.5px] text-ink-3">Lädt …</p>
                ) : libraryItems.length === 0 ? (
                  <p className="col-span-4 py-8 text-center text-[12.5px] text-ink-3">Noch keine Bilder in der Bibliothek.</p>
                ) : libraryItems.map((item) => {
                  const sel = selectedImages.some((s) => s.libraryId === item.id);
                  return (
                    <button key={item.id} type="button" onClick={() => toggleLibraryItem(item)}
                      className={`relative aspect-square overflow-hidden rounded-md border transition-all ${sel ? 'border-ink border-2' : 'border-line hover:border-line-strong'}`}>
                      {item.file_preview ? (
                        <Image src={directusAssetUrl(item.file_preview, 'width=120&quality=70')} alt="" fill className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-panel">
                          <i className="ti ti-photo text-[20px] text-ink-3" aria-hidden="true" />
                        </div>
                      )}
                      {sel && (
                        <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink">
                          <i className="ti ti-check text-[11px] text-white" aria-hidden="true" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aus Ordner */}
          {sourceTab === 'ordner' && (
            <div className="flex flex-1 flex-col">
              {!openFolderId ? (
                <div className="p-2">
                  {selectableFolders.map((folder) => (
                    <button key={folder.id} type="button" onClick={() => openFolder(folder.id)}
                      className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-panel">
                      <i className="ti ti-folder text-[16px] text-ink-3" aria-hidden="true" />
                      <span className="flex-1 text-[13px]">{folder.name}</span>
                      <i className="ti ti-chevron-right text-[13px] text-ink-3" aria-hidden="true" />
                    </button>
                  ))}
                  {selectableFolders.length === 0 && (
                    <p className="py-8 text-center text-[12.5px] text-ink-3">Noch keine eigenen Ordner.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="border-b border-line px-3 py-2">
                    <button type="button" onClick={() => { setOpenFolderId(null); setFolderPosts([]); }}
                      className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-2 hover:text-ink">
                      <i className="ti ti-arrow-left text-[13px]" aria-hidden="true" />
                      Zurück zu Ordnern
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-3">
                    {folderLoading ? (
                      <p className="col-span-4 py-8 text-center text-[12.5px] text-ink-3">Lädt …</p>
                    ) : folderPosts.flatMap((post) =>
                      [...(post.images || [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).map((img, imgIdx) => {
                        const key = `${post.id}-${imgIdx}`;
                        const sel = selectedImages.some((s) => s.libraryId === key);
                        return (
                          <button key={key} type="button"
                            onClick={() => {
                              if (sel) {
                                setSelectedImages((prev) => prev.filter((s) => s.libraryId !== key));
                              } else if (selectedImages.length < MAX_IMAGES && img.file_public_preview) {
                                setSelectedImages((prev) => [...prev, {
                                  source: 'library', libraryId: key,
                                  previewUrl: directusAssetUrl(img.file_public_preview!, 'width=200&quality=70'),
                                  caption: '',
                                }]);
                              }
                            }}
                            className={`relative aspect-square overflow-hidden rounded-md border transition-all ${sel ? 'border-ink border-2' : 'border-line hover:border-line-strong'}`}>
                            {img.file_public_preview ? (
                              <Image src={directusAssetUrl(img.file_public_preview, 'width=120&quality=70')} alt="" fill className="object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-panel">
                                <i className="ti ti-photo text-[20px] text-ink-3" aria-hidden="true" />
                              </div>
                            )}
                            {sel && (
                              <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink">
                                <i className="ti ti-check text-[11px] text-white" aria-hidden="true" />
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Ausgewählte Bilder */}
          <div className="border-t border-line p-3">
            {selectedImages.length === 0 ? (
              <p className="text-[12px] text-ink-3">Noch keine Bilder gewählt</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedImages.map((img, i) => (
                  <div key={i} className="relative h-12 w-12 flex-shrink-0">
                    {img.previewUrl ? (
                      <Image src={img.previewUrl} alt="" fill className="rounded-md object-cover border border-line" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-md bg-panel border border-line">
                        <i className="ti ti-photo text-[16px] text-ink-3" aria-hidden="true" />
                      </div>
                    )}
                    <button type="button" onClick={() => removeSelected(i)} aria-label="Entfernen"
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[9px] text-white">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RECHTE SPALTE: Metadaten ── */}
        <div className="flex flex-col rounded-[10px] border border-line bg-white overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="text-[12.5px] font-semibold text-ink-2">Inhalt</span>
            <div className="ml-auto flex gap-1 rounded-md border border-line-strong bg-panel p-0.5">
              {(['einsatz', 'stockfoto'] as PostMode[]).map((mode) => (
                <button key={mode} type="button" onClick={() => setPostMode(mode)}
                  className={`rounded px-3 py-1.5 text-[12px] font-semibold transition-colors ${postMode === mode ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
                  {mode === 'einsatz' ? 'Einsatz' : 'Stockfoto'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {postMode === 'einsatz' && (
              <div className="flex flex-col gap-3 rounded-md border border-line bg-panel p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">Einsatzdaten</p>
                <div>
                  <label className={labelClass}>Titel *</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    className={fieldClass} placeholder="Zimmerbrand Hauptstraße" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Datum *</label>
                    <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Alarmcode *</label>
                    <AlarmCodeInput value={alarmCode} onChange={setAlarmCode} alarmcodes={alarmcodes} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Ort *</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                    className={fieldClass} placeholder="Musterstadt" />
                </div>
                <div>
                  <label className={labelClass}>Artikeltext (optional)</label>
                  <RichTextEditor value={articleBody} onChange={setArticleBody} />
                </div>
              </div>
            )}

            {postMode === 'stockfoto' && (
              <div className="rounded-md border border-line bg-panel px-3 py-2.5 text-[12px] text-ink-2">
                <i className="ti ti-info-circle mr-1.5 text-[13px]" aria-hidden="true" />
                Stockfoto — kein Einsatzdatum oder Alarmcode nötig.
              </div>
            )}

            <div>
              <label className={labelClass}>Tags</label>
              <div className="flex flex-wrap gap-1.5 rounded-md border border-line-strong bg-white px-3 py-2 cursor-text min-h-[40px]"
                onClick={() => document.getElementById('tag-input')?.focus()}>
                {tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-[4px] bg-panel border border-line-strong px-2 py-0.5 text-[11.5px]">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} className="text-ink-3 hover:text-ink leading-none">✕</button>
                  </span>
                ))}
                <input id="tag-input" value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); } }}
                  placeholder={tags.length === 0 ? 'Tag eingeben, Enter drücken …' : ''}
                  list="tag-suggestions"
                  className="flex-1 min-w-[80px] bg-transparent text-[13px] outline-none" />
                <datalist id="tag-suggestions">
                  {existingTags.filter((t) => !tags.includes(t)).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className={labelClass}>Ordner</label>
              <select value={folderChoice} onChange={(e) => setFolderChoice(e.target.value)} className={fieldClass}>
                <option value="">Unsortiert (Standard)</option>
                {selectableFolders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
                <option value={NEW_FOLDER_VALUE}>+ Neuen Ordner anlegen …</option>
              </select>
              {folderChoice === NEW_FOLDER_VALUE && (
                <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Name des neuen Ordners" className={`${fieldClass} mt-2`} />
              )}
            </div>

            <div className="rounded-md border border-line bg-panel p-3">
              <label className="flex cursor-pointer items-center gap-3">
                <div onClick={() => setMakePublic((v) => !v)}
                  className={`relative h-6 w-10 flex-shrink-0 rounded-full transition-colors ${makePublic ? 'bg-ink' : 'bg-line-strong'}`}>
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${makePublic ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-[13px] font-medium">{makePublic ? 'Direkt öffentlich machen' : 'Als Entwurf speichern'}</span>
              </label>
              {makePublic && (
                <p className="mt-1.5 text-[11.5px] text-ink-2">
                  <i className="ti ti-folder-open mr-1 text-[12px]" aria-hidden="true" />
                  Landet automatisch in Ordner "Öffentlich"
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-md bg-panel px-3 py-2 text-[12px] text-ink-2">
              <i className="ti ti-lock text-[13px]" aria-hidden="true" />
              Alle Fotos erhalten automatisch das Wasserzeichen "{watermarkText}"
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line-strong bg-panel p-3 text-[12px] leading-[1.55] text-ink-2">
              <input type="checkbox" checked={contentConfirmed}
                onChange={(e) => setContentConfirmed(e.target.checked)} className="mt-0.5" />
              <span>
                Ich bestätige, dass ich zur Veröffentlichung dieser Fotos berechtigt bin und sie keine privaten oder unangemessenen Inhalte zeigen. *
              </span>
            </label>
          </div>

          <div className="border-t border-line p-4">
            {error && <p className="mb-3 text-[12.5px] text-signal-deep">{error}</p>}
            {progress && <p className="mb-3 text-[12.5px] text-ink-2">{progress}</p>}
            <button type="submit" disabled={status === 'working'}
              className="w-full rounded-md bg-ink px-5 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-60">
              {status === 'working' ? 'Wird verarbeitet …' : (
                <>
                  <i className="ti ti-upload mr-2 text-[14px]" aria-hidden="true" />
                  {selectedImages.length > 0
                    ? `${selectedImages.length} Foto${selectedImages.length === 1 ? '' : 's'} hochladen`
                    : 'Hochladen'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
