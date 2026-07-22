import { NextRequest, NextResponse } from 'next/server';
import { deleteSubscription, findByUnsubscribeToken } from '@/lib/subscriptions';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const baseUrl = request.nextUrl.origin;

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/presse-alarm?status=invalid`);
  }

  const sub = await findByUnsubscribeToken(token);
  if (!sub) {
    return NextResponse.redirect(`${baseUrl}/presse-alarm?status=invalid`);
  }

  await deleteSubscription(sub.id);
  return NextResponse.redirect(`${baseUrl}/presse-alarm?status=unsubscribed`);
}
