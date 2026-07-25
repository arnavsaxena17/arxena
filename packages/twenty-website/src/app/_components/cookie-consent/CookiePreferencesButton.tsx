'use client';

import { ReactNode } from 'react';

import { useCookieConsent } from './CookieConsentProvider';

type CookiePreferencesButtonProps = {
  className?: string;
  children?: ReactNode;
};

export const CookiePreferencesButton = ({
  className,
  children = 'Cookie preferences',
}: CookiePreferencesButtonProps) => {
  const { openPreferences } = useCookieConsent();

  return (
    <button type="button" className={className} onClick={openPreferences}>
      {children}
    </button>
  );
};
