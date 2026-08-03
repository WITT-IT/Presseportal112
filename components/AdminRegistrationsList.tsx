'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDialog } from './DialogProvider';

type Registration = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  requested_organization_name: string | null;
  requested_gewerk: string | null;
  requested_website: string | null;
  requested_social_links: Record<string, string> | null;
  requested_account_type: string | null;
};

type OrgOption = { id: string; name: string; organization_type?: string | null };

export default function AdminRegistrationsList({
  registrations,
  organizations,
}: {
  registrations: Registration[];
  organizations: OrgOption[];
}) {
  const router = useRouter();
  const { confirm } = useDialog();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(id: string) {
    const organizationId = selected[id];
    if (!organizationId) {
      setError('Bitte zuerst eine Organisation auswählen.');
      return;
    }
    const organizationName = organizations.find((org) => org.id === organizationId)?.name;

    setError(null);
    setBusyId(id);
    const res = await fetch(`/api/admin/registrations/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, organizationName }),
    });
    setBusyId(null);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Freigabe fehlgeschlagen.');
    }
  }

  async function handleReject(id: string, email: string) {
    const confirmed = await confirm({
      title: `Registrierung von ${email} ablehnen?`,
      message: 'Das Konto wird dabei komplett gelöscht.',
      confirmLabel: 'Ablehnen und löschen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    setBusyId(id);
    await fetch(`/api/admin/registrations/${id}`, { method: 'DELETE' });
    setBusyId(null);
    router.refresh();
  }

  if (registrations.length === 0) {
    return <p className="text-[13px] text-ink-2">Keine offenen Registrierungen.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-[12.5px] text-signal-deep">{error}</p>}
      {registrations.map((reg) => (
        <div key={reg.id} className="rounded-[10px] border border-line bg-white p-4">
          <div className="mb-1 flex items-center gap-2 text-[13.5px] font-medium">
            {[reg.first_name, reg.last_name].filter(Boolean).join(' ') || reg.email}
            {reg.requested_account_type === 'press' && (
              <span className="rounded-[4px] bg-signal px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.04em] text-white">
                Presse
              </span>
            )}
          </div>
          <div className="mb-3 text-[12px] text-ink-2">
            {reg.email}
            {reg.requested_organization_name
              ? reg.requested_account_type === 'press'
                ? ` · Redaktion: „${reg.requested_organization_name}"`
                : ` · möchte für „${reg.requested_organization_name}" (${
                    reg.requested_gewerk ?? 'unbekanntes Gewerk'
                  }) registriert werden`
              : ''}
          </div>
          {(reg.requested_website ||
            (reg.requested_social_links && Object.keys(reg.requested_social_links).length > 0)) && (
            <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
              {reg.requested_website && (
                <a
                  href={reg.requested_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 underline hover:text-ink"
                >
                  <i className="ti ti-world text-[13px]" aria-hidden="true" />
                  Website
                </a>
              )}
              {reg.requested_social_links &&
                Object.entries(reg.requested_social_links).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 underline hover:text-ink"
                  >
                    <i className="ti ti-link text-[13px]" aria-hidden="true" />
                    {platform}
                  </a>
                ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selected[reg.id] ?? ''}
              onChange={(e) => setSelected((prev) => ({ ...prev, [reg.id]: e.target.value }))}
              disabled={busyId === reg.id}
              className="rounded-md border border-line-strong bg-white px-3 py-2 text-[12.5px] outline-none focus:border-ink"
            >
              <option value="">Organisation zuweisen …</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                  {org.organization_type === 'press' ? ' (Presse)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleApprove(reg.id)}
              disabled={busyId === reg.id}
              className="rounded-md bg-ink px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
            >
              Freigeben
            </button>
            <button
              type="button"
              onClick={() => handleReject(reg.id, reg.email)}
              disabled={busyId === reg.id}
              className="rounded-md border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-signal-deep transition-colors hover:border-signal disabled:opacity-50"
            >
              Ablehnen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
