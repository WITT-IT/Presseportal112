import type { Metadata } from 'next';
import { Barlow_Condensed, Inter, JetBrains_Mono } from 'next/font/google';
import DateLine from '@/components/DateLine';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body
        className={`${barlow.variable} ${inter.variable} ${jetbrains.variable} font-sans bg-paper text-ink antialiased`}
      >
        <DateLine />
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
