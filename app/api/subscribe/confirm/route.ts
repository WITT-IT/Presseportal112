import { NextRequest, NextResponse } from 'next/server';
import { confirmSubscription, findByConfirmToken } from '@/lib/subscriptions';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const baseUrl = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/presse-alarm?status=invalid`);
  }

  const sub = await findByConfirmToken(token);
  if (!sub) {
    return NextResponse.redirect(`${baseUrl}/presse-alarm?status=invalid`);
  }

  await confirmSubscription(sub.id);
  return NextResponse.redirect(`${baseUrl}/presse-alarm?status=confirmed`);
}
