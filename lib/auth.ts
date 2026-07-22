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
    throw new Error('Anmeldung fehlgeschlagen');
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
    `${DIRECTUS_URL}/users/me?fields=id,email,first_name,last_name,status,organization.id,organization.name,organization.gewerk`,
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
    maxAge: 60 * 60 * 24 * 7, // 7 Tage -- entspricht der Directus-Refresh-Token-Gültigkeit
  };
}
