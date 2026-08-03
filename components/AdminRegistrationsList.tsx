'use client';

import { useMemo, useState } from 'react';
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

const GEWERK_OPTIONS = [
  { id: 'feuerwehr', name: 'Feuerwehr' },
  { id: 'drk', name: 'DRK' },
  { id: 'polizei', name: 'Polizei' },
  { id: 'thw', name: 'THW' },
];

// Klassischer Levenshtein-Abstand -- reicht für "ist das dieselbe
// Organisation, evtl. mit Tippfehler" völlig aus, ohne eine externe
// Bibliothek zu brauchen.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

// 1 = identisch, 0 = komplett verschieden. Groß-/Kleinschreibung und
// doppelte Leerzeichen spielen bewusst keine Rolle (das wäre kein "echter"
// Tippfehler, sondern nur eine Formatierungs-Nuance).
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

export default function AdminRegistrationsList({
  registrations,
  organizations,
}: {
  registrations: Registration[];
  organizations: OrgOption[];
}) {
  const router = useRouter();
  const { confirm } = useDialog();

  async function handleReject(id: string, email: string) {
    const confirmed = await confirm({
      title: `Registrierung von ${email} ablehnen?`,
      message: 'Das Konto wird dabei komplett gelöscht.',
      confirmLabel: 'Ablehnen und löschen',
      cancelLabel: 'Abbrechen',
      danger: true,
    });
    if (!confirmed) return;

    await fetch(`/api/admin/registrations/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  if (registrations.length === 0) {
    return <p className="text-[13px] text-ink-2">Keine offenen Registrierungen.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {registrations.map((reg) => (
        <RegistrationCard
          key={reg.id}
          registration={reg}
          organizations={organizations}
          onReject={() => handleReject(reg.id, reg.email)}
        />
      ))}
    </div>
  );
}

function RegistrationCard({
  registration: reg,
  organizations,
  onReject,
}: {
  registration: Registration;
  organizations: OrgOption[];
  onReject: () => void;
}) {
  const router = useRouter();
  const isPress = reg.requested_account_type === 'press';

  const [mode, setMode] = useState<'new' | 'existing'>('new');
  // Vorausgefüllt mit dem, was die Person selbst eingegeben hat -- aber
  // bewusst editierbar, damit offensichtliche Tippfehler (z. B. "ORtsverein")
  // direkt hier korrigiert werden können, ohne Directus.
  const [orgName, setOrgName] = useState(reg.requested_organization_name || '');
  const [gewerk, setGewerk] = useState(reg.requested_gewerk || '');
  const [existingOrgId, setExistingOrgId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bestMatch = useMemo(() => {
    if (!orgName.trim()) return null;
    let best: { org: OrgOption; score: number } | null = null;
    for (const org of organizations) {
      const score = similarity(orgName, org.name);
      if (!best || score > best.score) best = { org, score };
    }
    return best && best.score >= 0.6 ? best : null;
  }, [orgName, organizations]);

  async function handleApprove() {
    setError(null);
    if (mode === 'new') {
      if (!orgName.trim()) {
        setError(`Bitte ${isPress ? 'eine Redaktion' : 'einen Organisationsnamen'} angeben.`);
        return;
      }
      if (!isPress && !gewerk) {
        setError('Bitte ein Gewerk auswählen.');
        return;
      }
    } else if (!existingOrgId) {
      setError('Bitte eine bestehende Organisation auswählen.');
      return;
    }

    setBusy(true);
    const res = await fetch(`/api/admin/registrations/${reg.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        mode === 'new'
          ? { newOrganizationName: orgName.trim(), newOrganizationGewerk: isPress ? null : gewerk }
          : {
              organizationId: existingOrgId,
              organizationName: organizations.find((o) => o.id === existingOrgId)?.name,
            }
      ),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Freigabe fehlgeschlagen.');
    }
  }

  return (
    <div className="rounded-[10px] border border-line bg-white p-4">
      <div className="mb-1 flex items-center gap-2 text-[13.5px] font-medium">
        {[reg.first_name, reg.last_name].filter(Boolean).join(' ') || reg.email}
        {isPress && (
          <span className="rounded-[4px] bg-signal px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.04em] text-white">
            Presse
          </span>
        )}
      </div>
      <div className="mb-3 text-[12px] text-ink-2">{reg.email}</div>

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

      <div className="mb-3 rounded-md border border-line bg-panel p-3">
        <div className="mb-2.5 flex gap-1.5 text-[11.5px] font-semibold">
          <button
            type="button"
            onClick={() => setMode('new')}
            className={`rounded-md px-2.5 py-1.5 transition-colors ${
              mode === 'new' ? 'bg-ink text-white' : 'text-ink-2 hover:bg-line'
            }`}
          >
            Neu anlegen
          </button>
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`rounded-md px-2.5 py-1.5 transition-colors ${
              mode === 'existing' ? 'bg-ink text-white' : 'text-ink-2 hover:bg-line'
            }`}
          >
            Bestehende verknüpfen
          </button>
        </div>

        {mode === 'new' ? (
          <div className="flex flex-col gap-2.5">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-ink-2">
                {isPress ? 'Redaktion / Publikation' : 'Organisationsname'}
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[13px] outline-none focus:border-ink"
              />
            </div>
            {!isPress && (
              <div>
                <label className="mb-1 block text-[11px] font-medium text-ink-2">Gewerk</label>
                <select
                  value={gewerk}
                  onChange={(e) => setGewerk(e.target.value)}
                  className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[13px] outline-none focus:border-ink"
                >
                  <option value="">Bitte wählen …</option>
                  {GEWERK_OPTIONS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {bestMatch && (
              <div className="rounded-md border border-signal/40 bg-signal/5 px-3 py-2 text-[11.5px] leading-[1.5] text-signal-deep">
                <i className="ti ti-alert-triangle mr-1 text-[13px]" aria-hidden="true" />
                Ähnlich zu bereits vorhandener Organisation „{bestMatch.org.name}"
                {bestMatch.score > 0.95 ? ' (fast identisch!)' : ''} — evtl. ist das
                dieselbe?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('existing');
                    setExistingOrgId(bestMatch.org.id);
                  }}
                  className="font-semibold underline"
                >
                  Stattdessen verknüpfen
                </button>
              </div>
            )}
          </div>
        ) : (
          <select
            value={existingOrgId}
            onChange={(e) => setExistingOrgId(e.target.value)}
            className="w-full rounded-md border border-line-strong bg-white px-3 py-2 text-[13px] outline-none focus:border-ink"
          >
            <option value="">Organisation auswählen …</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
                {org.organization_type === 'press' ? ' (Presse)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="mb-2 text-[12px] text-signal-deep">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy}
          className="rounded-md bg-ink px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-black disabled:opacity-50"
        >
          {busy ? '…' : mode === 'new' ? 'Anlegen und freigeben' : 'Freigeben'}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          className="rounded-md border border-line-strong px-4 py-2 text-[12.5px] font-semibold text-signal-deep transition-colors hover:border-signal disabled:opacity-50"
        >
          Ablehnen
        </button>
      </div>
    </div>
  );
}
