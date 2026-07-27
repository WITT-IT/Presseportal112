import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { DIRECTUS_URL } from '@/lib/directus';
import { getConfirmedSubscriptionsForGewerk } from '@/lib/subscriptions';
import { sendNewImageAlert } from '@/lib/email';

export async function POST(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return NextResponse.json({ error: 'Nicht angemeldet.' }, { status: 401 });
  }

  let session: { accessToken: string };
  try {
    session = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Sitzung ungültig.' }, { status: 401 });
  }

  const { id, isPublic } = await request.json().catch(() => ({}));
  if (!id || typeof isPublic !== 'boolean') {
    return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400 });
  }

  // Kein manueller Besitz-Check nötig -- die Organisation-Policy in Directus
  // lässt ein Update nur zu, wenn das Bild wirklich zur eigenen Organisation
  // gehört. Gehört es einer anderen, antwortet Directus selbst mit 403.
  // Fragt gleich die Felder mit ab, die wir für den Presse-Alarm brauchen --
  // spart einen zweiten Request.
  const res = await fetch(
    `${DIRECTUS_URL}/items/posts/${id}?fields=id,title,alarm_code,organization.name,organization.gewerk`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        is_public: isPublic,
        published_at: isPublic ? new Date().toISOString() : null,
      }),
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: 'Aktualisierung fehlgeschlagen.' },
      { status: res.status === 403 ? 403 : 500 }
    );
  }

  // Presse-Alarm nur beim tatsächlichen Veröffentlichen auslösen, nicht beim
  // Zurückziehen -- und bewusst so abgesichert, dass ein Problem beim
  // Mailversand niemals die eigentliche Veröffentlichung scheitern lässt.
  if (isPublic) {
    try {
      const { data: updatedPost } = await res.json();
      const gewerkId = updatedPost?.organization?.gewerk;

      if (gewerkId) {
        const subs = await getConfirmedSubscriptionsForGewerk(gewerkId);
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
        const articleUrl = `${siteUrl}/bildarchiv/${updatedPost.id}`;

        await Promise.allSettled(
          subs.map((sub) =>
            sendNewImageAlert({
              to: sub.email,
              unsubscribeToken: sub.unsubscribe_token,
              imageTitle: updatedPost.title || updatedPost.alarm_code || 'Neues Einsatzfoto',
              organizationName: updatedPost.organization?.name || 'Presseportal112',
              articleUrl,
            })
          )
        );
      }
    } catch (error) {
      console.error('Presse-Alarm: Benachrichtigung fehlgeschlagen:', error);
    }
  }

  return NextResponse.json({ ok: true });
}
