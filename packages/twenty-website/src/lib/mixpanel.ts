'use client';

import type { Mixpanel } from 'mixpanel-browser';

let mixpanelInstance: Mixpanel | null = null;

const getToken = () =>
  process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || '68bdb1eed9eee266fc652c9d5ecef47e';

async function getMixpanel() {
  if (typeof window === 'undefined') return null;
  if (!mixpanelInstance) {
    const mixpanel = await import('mixpanel-browser');
    const instance = mixpanel.default;
    instance.init(getToken(), {
      debug: process.env.NODE_ENV !== 'production',
      track_pageview: true,
      persistence: 'localStorage',
    });
    mixpanelInstance = instance;
  }
  return mixpanelInstance;
}

const isTrackingEnabled = () =>
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development';

export const trackWebsiteEvent = (
  eventName: string,
  props?: Record<string, unknown>,
) => {
  if (typeof window === 'undefined' || !isTrackingEnabled()) return;
  getMixpanel().then((mp) => {
    if (mp) {
      mp.track(eventName, {
        ...props,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        source: 'website',
      });
    }
  });
};
