import { Metadata } from 'next';
import { PublicEnvScript } from 'next-runtime-env';
import { Gabarito, Inter } from 'next/font/google';

import { FooterDesktop } from './_components/ui/layout/FooterDesktop';
import EmotionRootStyleRegistry from './emotion-root-style-registry';

import './layout.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Arxena — Full-company org charts in 5 minutes',
  description:
    "See exactly who built your competitors' teams. Full-company org charts for 100,000+ employees at companies like Google, Apple, Microsoft. Talent intelligence built for recruiting.",
  icons: '/images/core/logo.svg',
};

const gabarito = Gabarito({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: false,
  variable: '--font-gabarito',
});

const inter = Inter({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: false,
  variable: '--font-inter',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${gabarito.variable} ${inter.variable}`}>
      <body>
        <PublicEnvScript />
        <EmotionRootStyleRegistry>
          {/* <AppHeader /> */}
          <div className="container">{children}</div>
          <FooterDesktop />
        </EmotionRootStyleRegistry>
      </body>
    </html>
  );
}
