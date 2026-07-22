import { randomUUID } from 'node:crypto';
import { DIRECTUS_URL } from './directus';

const SERVICE_TOKEN = process.env.DIRECTUS_SERVICE_TOKEN;

function serviceHeaders() {
  if (!SERVICE_TOKEN) {
    throw new Error('DIRECTUS_SERVICE_TOKEN fehlt -- Presse-Alarm kann nicht arbeiten.');
  }
  return {
    Authorization: `Bearer ${SERVICE_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

export type Subscription = {
  id: string;
  email: string;
  gewerke: string[];
  confirmed: boolean;
  confirm_token: string;
  unsubscribe_token: string;
};

export async function createSubscription(email: string, gewerke: string[]): Promise<Subscription> {
  const res = await fetch(`${DIRECTUS_URL}/items/subscriptions`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({
      email,
      gewerke,
      confirmed: false,
      confirm_token: randomUUID(),
      unsubscribe_token: randomUUID(),
    }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const { data } = await res.json();
  return data;
}

export async function findByConfirmToken(token: string): Promise<Subscription | null> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/subscriptions?filter[confirm_token][_eq]=${encodeURIComponent(token)}&limit=1`,
    { headers: serviceHeaders() }
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data?.[0] ?? null;
}

export async function findByUnsubscribeToken(token: string): Promise<Subscription | null> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/subscriptions?filter[unsubscribe_token][_eq]=${encodeURIComponent(token)}&limit=1`,
    { headers: serviceHeaders() }
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data?.[0] ?? null;
}

export async function confirmSubscription(id: string) {
  await fetch(`${DIRECTUS_URL}/items/subscriptions/${id}`, {
    method: 'PATCH',
    headers: serviceHeaders(),
    body: JSON.stringify({ confirmed: true }),
  });
}

export async function deleteSubscription(id: string) {
  await fetch(`${DIRECTUS_URL}/items/subscriptions/${id}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
  });
}

// Holt alle bestätigten Abos für ein Gewerk. Filtert bewusst in unserem
// eigenen Code statt über einen Directus-Filter auf dem JSON-Feld
// "gewerke" -- gleiches Prinzip wie bei den Tags: zuverlässig statt
// gehofft.
export async function getConfirmedSubscriptionsForGewerk(gewerkId: string): Promise<Subscription[]> {
  const res = await fetch(
    `${DIRECTUS_URL}/items/subscriptions?filter[confirmed][_eq]=true&limit=-1`,
    { headers: serviceHeaders() }
  );
  if (!res.ok) return [];
  const { data } = await res.json();
  return (data as Subscription[]).filter((s) => (s.gewerke || []).includes(gewerkId));
}
