import { NextRequest, NextResponse } from 'next/server';
import { createSubscription } from '@/lib/subscriptions';
import { sendSubscriptionConfirmEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { email, gewerke } = body || {};

  if (!email || !Array.isArray(gewerke) || gewerke.length === 0) {
    return NextResponse.json(
      { error: 'Bitte E-Mail und mindestens ein Gewerk auswählen.' },
      { status: 400 }
    );
  }

  try {
    const sub = await createSubscription(email, gewerke);
    await sendSubscriptionConfirmEmail(sub.email, sub.confirm_token);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Presse-Alarm-Anmeldung fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Anmeldung gerade nicht möglich. Bitte später erneut versuchen.' },
      { status: 500 }
    );
  }
}
