import { DIRECTUS_URL } from '@/lib/directus';
import JoinForm from '@/components/JoinForm';

export const dynamic = 'force-dynamic';

async function getInvitePreview(token: string) {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) return null;
  try {
    const res = await fetch(
      `${DIRECTUS_URL}/items/organization_invites?filter[token][_eq]=${encodeURIComponent(
        token
      )}&fields=organization.name,expires_at,used_at&limit=1`,
      { headers: { Authorization: `Bearer ${serviceToken}` }, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const { data } = await res.json();
    const invite = data?.[0];
    if (!invite) return null;
    if (invite.used_at) return { valid: false as const };
    if (new Date(invite.expires_at).getTime() < Date.now()) return { valid: false as const };
    return { valid: true as const, organizationName: invite.organization.name as string };
  } catch (error) {
    console.error('getInvitePreview fehlgeschlagen:', error);
    return null;
  }
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const preview = token ? await getInvitePreview(token) : null;

  return (
    <section className="flex min-h-[65vh] items-center justify-center px-8 py-16">
      <div className="w-full max-w-[420px]">
        {!token || !preview || !preview.valid ? (
          <div className="rounded-[10px] border border-line bg-white p-8 text-center">
            <i
              className="ti ti-alert-triangle mb-3 block text-[28px] text-signal-deep"
              aria-hidden="true"
            />
            <h1 className="mb-2 font-display text-[22px] font-bold">
              Einladung nicht gültig
            </h1>
            <p className="text-[13.5px] text-ink-2">
              Dieser Link ist ungültig, abgelaufen oder wurde bereits
              verwendet. Bitte bei der einladenden Person eine neue
              Einladung anfordern.
            </p>
          </div>
        ) : (
          <>
            <h1 className="mb-2 font-display text-[28px] font-bold">
              Bei {preview.organizationName} mitmachen
            </h1>
            <p className="mb-8 text-[13.5px] text-ink-2">
              Dein Konto ist sofort einsatzbereit — keine weitere Wartezeit.
            </p>
            <JoinForm token={token} />
          </>
        )}
      </div>
    </section>
  );
}
