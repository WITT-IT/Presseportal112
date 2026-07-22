import { DIRECTUS_URL } from './directus';

export const SESSION_COOKIE = 'pp_session';

export type Session = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix-Zeit in Millisekunden
};

export async function loginWithDirectus(
  email: string,
  password: string
): Promise<Session> {
  const res = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body?.errors?.[0]?.message || `Directus antwortete mit Status ${res.status}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

  const { data } = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires,
  };
}

export async function refreshDirectusSession(
  refreshToken: string
): Promise<Session | null> {
  const res = await fetch(`${DIRECTUS_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
    cache: 'no-store',
  });

  if (!res.ok) return null;

  const { data } = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires,
  };
}

export async function logoutDirectus(refreshToken: string) {
  await fetch(`${DIRECTUS_URL}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken, mode: 'json' }),
    cache: 'no-store',
  }).catch(() => {
    // Beim Logout bewusst keinen Fehler nach außen geben -- das lokale
    // Cookie wird in jedem Fall gelöscht, auch wenn Directus mal nicht
    // erreichbar ist.
  });
}

// Holt das eigene Profil inkl. Organisation -- für die Begrüßung im
// internen Bereich und um zu prüfen, ob der Account wirklich freigeschaltet ist.
export async function getCurrentUser(accessToken: string) {
  const res = await fetch(
    `${DIRECTUS_URL}/users/me?fields=id,email,first_name,last_name,status,organization.id,organization.name,organization.gewerk,organization.branding_label`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) return null;
  const { data } = await res.json();
  return data;
}

export function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 10, // 10 Minuten -- gleitendes Fenster, siehe middleware.ts
  };
}
