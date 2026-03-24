'use client';

export const openSupportChat = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const chatwoot = (
    window as Window & {
      $chatwoot?: {
        toggle?: (state?: 'open' | 'close') => void;
        toggleBubbleVisibility?: (visibility: 'show' | 'hide') => void;
      };
    }
  ).$chatwoot;

  chatwoot?.toggleBubbleVisibility?.('show');
  chatwoot?.toggle?.('open');
};
