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

// Prüft unabhängig vom eigenen Nutzer-Token über den Service-Token, ob ein
// bestimmter Benutzer die echte Directus-Systemrolle "Administrator" hat.
export async function isAdministrator(userId: string): Promise<boolean> {
  const serviceToken = process.env.DIRECTUS_SERVICE_TOKEN;
  if (!serviceToken) {
    console.error('isAdministrator: DIRECTUS_SERVICE_TOKEN fehlt.');
    return false;
  }
  try {
    const res = await fetch(`${DIRECTUS_URL}/users/${userId}?fields=role.name`, {
      headers: { Authorization: `Bearer ${serviceToken}` },
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(
        `isAdministrator: Directus antwortete mit Status ${res.status} für Nutzer ${userId}:`,
        body
      );
      return false;
    }
    const { data } = await res.json();
    console.log(`isAdministrator: Nutzer ${userId} hat Rolle`, JSON.stringify(data?.role));
    return data?.role?.name === 'Administrator';
  } catch (error) {
    console.error('isAdministrator: Anfrage fehlgeschlagen:', error);
    return false;
  }
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
