import { Metadata } from 'next';
import { PublicEnvScript } from 'next-runtime-env';
import { Gabarito, Inter } from 'next/font/google';
import Script from 'next/script';

import { WebSiteStructuredData } from './_components/StructuredData';
import { ConditionalFooter } from './_components/ui/layout/footer';
import EmotionRootStyleRegistry from './emotion-root-style-registry';

import './layout.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL('https://arxena.com'),
  title: 'Arxena.com',
  description:
    'Search and explore organizational charts of any company. 1M+ companies, 55M+ professionals for recruitment and talent mapping.',
  icons: {
    icon: [
      { url: '/images/favicon/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/images/favicon/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/images/favicon/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/favicon/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/images/favicon/icon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/images/favicon/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/images/favicon/icon-128.png', sizes: '128x128', type: 'image/png' },
      { url: '/images/favicon/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/images/favicon/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/images/favicon/icon-180.png',
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
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-8TK071FYGG"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-8TK071FYGG');
            `,
          }}
        />
        <WebSiteStructuredData />
        <PublicEnvScript />
        <EmotionRootStyleRegistry>
          {/* <AppHeader /> */}
          <div className="container">{children}</div>
          <ConditionalFooter />
        </EmotionRootStyleRegistry>
        <Script
          id="tawk-to"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){ var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true; s1.src='https://embed.tawk.to/61401352d326717cb6814b43/1ffh4mvd2';
s1.charset='UTF-8'; s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0); })();`,
          }}
        />
      </body>
    </html>
  );
}
