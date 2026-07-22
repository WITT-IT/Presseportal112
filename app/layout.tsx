import type { Metadata } from 'next';
import { Barlow_Condensed, Inter, JetBrains_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import DateLine from '@/components/DateLine';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { CartProvider } from '@/components/CartProvider';
import { SESSION_COOKIE } from '@/lib/auth';
import './globals.css';

const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains',
  display: 'swap',
});

// Fällt NEXT_PUBLIC_SITE_URL leer oder ungültig aus, soll der Build trotzdem
// durchlaufen -- lieber ein Fallback als ein abgestürzter Deploy wegen einer
// einzelnen falsch gesetzten Variable.
function resolveSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      console.warn(
        `NEXT_PUBLIC_SITE_URL ("${raw}") ist keine gültige URL, nutze Fallback.`
      );
    }
  }
  return new URL('http://localhost:3000');
}

const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: 'Presseportal112.de — Offizielles Bild- und Medienportal',
    template: '%s — Presseportal112.de',
  },
  description:
    'Freigegebene Einsatzfotos von Feuerwehr, DRK, Polizei und THW — geprüft, nach Alarmcode sortiert, sofort einsatzbereit für die Berichterstattung.',
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: 'Presseportal112.de',
    title: 'Presseportal112.de — Offizielles Bild- und Medienportal',
    description:
      'Freigegebene Einsatzfotos von Feuerwehr, DRK, Polizei und THW — geprüft, nach Alarmcode sortiert.',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Nur prüfen, ob ein (noch gültiges) Sitzungs-Cookie existiert -- bewusst
  // ohne eigenen Directus-Aufruf, damit das nicht jede einzelne Seite
  // (auch die öffentlichen) verlangsamt. Die Middleware kümmert sich beim
  // Betreten von /intern ohnehin schon um die echte Gültigkeitsprüfung.
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  let loggedIn = false;
  if (raw) {
    try {
      const session = JSON.parse(raw);
      loggedIn = typeof session?.accessToken === 'string';
    } catch {
      loggedIn = false;
    }
  }

  return (
    <html lang="de">
      <body
        className={`${barlow.variable} ${inter.variable} ${jetbrains.variable} font-sans bg-paper text-ink antialiased`}
      >
        <CartProvider>
          <DateLine />
          <Header loggedIn={loggedIn} />
          {children}
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
