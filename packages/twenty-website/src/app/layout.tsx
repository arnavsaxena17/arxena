import { Metadata } from 'next';
import { PublicEnvScript } from 'next-runtime-env';
import { Gabarito, Inter } from 'next/font/google';

import { DEFAULT_SITE_DESCRIPTION } from '@/lib/brand-content';
import { isPhase2Exposed } from '@/lib/sitemap';

import { ConsentGatedScripts } from './_components/cookie-consent/ConsentGatedScripts';
import { CookieConsentBanner } from './_components/cookie-consent/CookieConsentBanner';
import { CookieConsentProvider } from './_components/cookie-consent/CookieConsentProvider';
import { OrgChartDiagramReadyProvider } from './_components/cookie-consent/OrgChartDiagramReadyProvider';
import { FreeTrialFlowProvider } from './_components/free-trial/FreeTrialFlowProvider';
import { WebSiteStructuredData } from './_components/StructuredData';
import { ConditionalFooter } from './_components/ui/layout/footer';
import EmotionRootStyleRegistry from './emotion-root-style-registry';

import './layout.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL('https://arxena.com'),
  title: 'Arxena.com',
  description: DEFAULT_SITE_DESCRIPTION,
  icons: {
    icon: [
      {
        url: '/favicon.ico/favicon-96x96.png',
        sizes: '96x96',
        type: 'image/png',
      },
      { url: '/favicon.ico/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico/favicon.ico',
    apple: [
      {
        url: '/favicon.ico/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  manifest: '/favicon.ico/site.webmanifest',
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

export default async function RootLayout({
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
        <WebSiteStructuredData />
        <PublicEnvScript />
        <EmotionRootStyleRegistry>
          <CookieConsentProvider>
            <OrgChartDiagramReadyProvider>
              <ConsentGatedScripts />
              <CookieConsentBanner />
              <FreeTrialFlowProvider>
                {/* <AppHeader /> */}
                <div className="container">{children}</div>
                <ConditionalFooter phase2Exposed={isPhase2Exposed()} />
              </FreeTrialFlowProvider>
            </OrgChartDiagramReadyProvider>
          </CookieConsentProvider>
        </EmotionRootStyleRegistry>
      </body>
    </html>
  );
}
