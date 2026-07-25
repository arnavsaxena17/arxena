'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  PrivacyConsentAction,
  PrivacyConsentCategories,
  PrivacyConsentCookieValue,
} from 'twenty-shared/constants';

import {
  buildConsentCookieValue,
  createVisitorId,
  getConsentCategoriesForAction,
  writePrivacyConsentCookie,
} from '@/lib/cookie-consent/cookie-storage';

type CookieConsentContextValue = {
  consent: PrivacyConsentCookieValue | null;
  isResolved: boolean;
  isPreferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  saveConsent: (
    action: PrivacyConsentAction,
    customCategories?: PrivacyConsentCategories,
  ) => Promise<void>;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(
  null,
);

type CookieConsentProviderProps = {
  children: ReactNode;
  // Must come from the server request cookie so SSR and hydration match
  initialConsent?: PrivacyConsentCookieValue | null;
};

export const CookieConsentProvider = ({
  children,
  initialConsent = null,
}: CookieConsentProviderProps) => {
  const [consent, setConsent] = useState<PrivacyConsentCookieValue | null>(
    initialConsent,
  );
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

  const saveConsent = useCallback(
    async (
      action: PrivacyConsentAction,
      customCategories?: PrivacyConsentCategories,
    ) => {
      const categories = getConsentCategoriesForAction(
        action,
        customCategories,
      );
      const visitorId = consent?.visitorId ?? createVisitorId();
      const nextConsent = buildConsentCookieValue({
        visitorId,
        action,
        categories,
      });

      writePrivacyConsentCookie(nextConsent);
      setConsent(nextConsent);
      setIsPreferencesOpen(false);

      try {
        const response = await fetch('/api/privacy-consent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            visitorId: nextConsent.visitorId,
            action: nextConsent.action,
            policyVersion: nextConsent.policyVersion,
            categories: nextConsent.categories,
            locale:
              typeof navigator !== 'undefined' ? navigator.language : undefined,
          }),
        });

        if (!response.ok) {
          throw new Error(`Cookie consent API failed with ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to persist cookie consent to server', error);
      }
    },
    [consent?.visitorId],
  );

  const openPreferences = useCallback(() => {
    setIsPreferencesOpen(true);
  }, []);

  const closePreferences = useCallback(() => {
    setIsPreferencesOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      consent,
      isResolved: consent !== null,
      isPreferencesOpen,
      openPreferences,
      closePreferences,
      saveConsent,
    }),
    [
      closePreferences,
      consent,
      isPreferencesOpen,
      openPreferences,
      saveConsent,
    ],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
};

export const useCookieConsent = (): CookieConsentContextValue => {
  const context = useContext(CookieConsentContext);

  if (!context) {
    throw new Error(
      'useCookieConsent must be used within CookieConsentProvider',
    );
  }

  return context;
};
