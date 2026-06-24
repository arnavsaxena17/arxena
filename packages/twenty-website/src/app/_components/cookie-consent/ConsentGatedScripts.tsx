'use client';

import Script from 'next/script';
import { useEffect } from 'react';

import { MixpanelRouteSync } from '@/lib/MixpanelRouteSync';
import { initWebsiteMixpanelWithConsent } from '@/lib/mixpanel';

import { WebsiteSupportChat } from '../support/WebsiteSupportChat';
import { useCookieConsent } from './CookieConsentProvider';

const GA4_MEASUREMENT_ID = 'G-8TK071FYGG';

export const ConsentGatedScripts = () => {
  const { consent } = useCookieConsent();
  const analyticsEnabled = consent?.categories.analytics === true;
  const functionalEnabled = consent?.categories.functional === true;

  useEffect(() => {
    if (!analyticsEnabled) {
      return;
    }

    void initWebsiteMixpanelWithConsent();
  }, [analyticsEnabled]);

  return (
    <>
      {analyticsEnabled && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
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
                gtag('config', '${GA4_MEASUREMENT_ID}');
              `,
            }}
          />
          <MixpanelRouteSync />
        </>
      )}
      {functionalEnabled && <WebsiteSupportChat />}
    </>
  );
};
