import { Metadata } from 'next';
import { PublicEnvScript } from 'next-runtime-env';
import { Gabarito, Inter } from 'next/font/google';

import { ConditionalFooter } from './_components/ui/layout/footer';
import EmotionRootStyleRegistry from './emotion-root-style-registry';

import './layout.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Arxena.com',
  description: 'Open Source CRM',
  icons: {
    icon: [
      { url: '/images/favicon/16.png', sizes: '16x16', type: 'image/png' },
      { url: '/images/favicon/32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/favicon/192.png', sizes: '192x192', type: 'image/png' },
      { url: '/images/favicon/512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/images/favicon/180.png',
  },
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
    <html
      lang="en"
      className={`${gabarito.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <PublicEnvScript />
        <EmotionRootStyleRegistry>
          {/* <AppHeader /> */}
          <div className="container">{children}</div>
          <ConditionalFooter />
        </EmotionRootStyleRegistry>
      </body>
    </html>
  );
}
