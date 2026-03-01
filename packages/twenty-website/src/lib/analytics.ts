'use client';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export const trackGA4Event = (
  eventName: string,
  params?: Record<string, unknown>,
) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
};
