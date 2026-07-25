'use client';

import { Mixpanel } from 'mixpanel-browser';

let mixpanelInstance: Mixpanel | null = null;
let isMixpanelInitialized = false;

const DEFAULT_MIXPANEL_PRODUCTION_TOKEN = '68bdb1eed9eee266fc652c9d5ecef47e';

const DEFAULT_MIXPANEL_DEVELOPMENT_PROJECT_TOKEN =
  '5e39ab7cf4b71a25f7cf7bb16936ec1d';

const getToken = () => {
  if (process.env.NODE_ENV === 'production') {
    return (
      process.env.NEXT_PUBLIC_MIXPANEL_TOKEN ??
      DEFAULT_MIXPANEL_PRODUCTION_TOKEN
    );
  }
  return (
    process.env.NEXT_PUBLIC_MIXPANEL_DEV_TOKEN ??
    DEFAULT_MIXPANEL_DEVELOPMENT_PROJECT_TOKEN
  );
};

/** Production sends by default. Local/dev only when NEXT_PUBLIC_MIXPANEL_ALLOW_IN_DEVELOPMENT=true. */
const isMixpanelSendingEnabled =
  process.env.NODE_ENV === 'production' ||
  process.env.NEXT_PUBLIC_MIXPANEL_ALLOW_IN_DEVELOPMENT === 'true';

const applyCoreRegisteredSuperProperties = (instance: Mixpanel) => {
  if (!isMixpanelSendingEnabled || typeof window === 'undefined') {
    return;
  }
  const deployment =
    process.env.NEXT_PUBLIC_ANALYTICS_DEPLOYMENT ??
    process.env.NODE_ENV ??
    'unknown';
  const environment = process.env.NODE_ENV ?? 'unknown';
  instance.register({
    deployment,
    environment,
    workspace_subdomain: '(twenty-website)',
    pathname: window.location.pathname,
  });
};

async function getMixpanel() {
  if (typeof window === 'undefined' || !isMixpanelInitialized) return null;
  return mixpanelInstance;
}

const isTrackingEnabled = () =>
  isMixpanelSendingEnabled && isMixpanelInitialized;

export const initWebsiteMixpanelWithConsent = async () => {
  if (typeof window === 'undefined' || isMixpanelInitialized) {
    return;
  }

  const mixpanel = await import('mixpanel-browser');
  const instance = mixpanel.default;
  instance.init(getToken(), {
    debug: process.env.NODE_ENV !== 'production',
    track_pageview: isMixpanelSendingEnabled,
    persistence: 'localStorage',
  });
  applyCoreRegisteredSuperProperties(instance);
  mixpanelInstance = instance;
  isMixpanelInitialized = true;
};

export const trackWebsiteEvent = (
  eventName: string,
  props?: Record<string, unknown>,
) => {
  if (typeof window === 'undefined' || !isTrackingEnabled()) return;
  getMixpanel().then((mp) => {
    if (mp) {
      mp.track(eventName, {
        ...props,
        visitorDistinctId: mp.get_distinct_id(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        source: 'website',
      });
    }
  });
};

/** Updates registered `pathname` after client navigations (SPA). */
export const syncWebsiteMixpanelRouteContext = (pathname: string) => {
  if (typeof window === 'undefined' || !isTrackingEnabled()) return;
  void getMixpanel().then((mp) => {
    if (mp) {
      mp.register({ pathname });
    }
  });
};
