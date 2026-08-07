import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { BRANDING } from '@ecoswift/config/branding';
import { AppProviders } from '../components/providers/app-providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: { default: `${BRANDING.brandName} Admin`, template: `%s — ${BRANDING.brandName} Admin` },
  description: `Internal admin dashboard for ${BRANDING.brandName} — ${BRANDING.tagline}`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
