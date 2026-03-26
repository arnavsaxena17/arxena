'use client';

import { useEffect } from 'react';

const SDK_PATH = '/packs/js/sdk.js';

type ChatwootWindow = Window & {
  chatwootSettings?: Record<string, unknown>;
  chatwootSDK?: {
    run: (args: { websiteToken: string; baseUrl: string }) => void;
  };
  $chatwoot?: {
    toggle?: (state?: 'open' | 'close') => void;
    toggleBubbleVisibility?: (visibility: 'show' | 'hide') => void;
    setCustomAttributes?: (attributes: Record<string, unknown>) => void;
  };
};

export const WebsiteSupportChat = () => {
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_SUPPORT_CHATWOOT_BASE_URL;
    const websiteToken = process.env.NEXT_PUBLIC_SUPPORT_CHATWOOT_WEBSITE_TOKEN;

    if (!baseUrl || !websiteToken) {
      return;
    }

    const sdkUrl = `${baseUrl.replace(/\/$/, '')}${SDK_PATH}`;
    const chatwootWindow = window as ChatwootWindow;

    chatwootWindow.chatwootSettings = {
      hideMessageBubble: false,
      position: 'right',
      locale: 'en',
      darkMode: 'auto',
      type: 'expanded_bubble',
      launcherTitle: 'Ask Arxena',
    };

    const onReady = () => {
      chatwootWindow.$chatwoot?.setCustomAttributes?.({
        source: 'twenty-website',
        currentPage: window.location.pathname,
        currentUrl: window.location.href,
        host: window.location.host,
        brand: 'arxena',
      });
    };

    window.addEventListener('chatwoot:ready', onReady, { once: true });

    if (chatwootWindow.chatwootSDK) {
      chatwootWindow.chatwootSDK.run({ websiteToken, baseUrl });
      return;
    }

    const existingScript = document.querySelector(`script[src="${sdkUrl}"]`);

    if (existingScript) {
      return;
    }

    const script = document.createElement('script');
    script.src = sdkUrl;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      chatwootWindow.chatwootSDK?.run({ websiteToken, baseUrl });
    };
    document.body.appendChild(script);

    return () => {
      window.removeEventListener('chatwoot:ready', onReady);
    };
  }, []);

  return null;
};
