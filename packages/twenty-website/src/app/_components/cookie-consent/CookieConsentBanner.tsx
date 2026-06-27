'use client';

import styled from '@emotion/styled';
import Link from 'next/link';
import { useState } from 'react';
import {
    DEFAULT_ACCEPT_ALL_CONSENT_CATEGORIES,
    DEFAULT_REJECT_CONSENT_CATEGORIES,
    PrivacyConsentCategories,
} from 'twenty-shared';

import { useCookieConsent } from './CookieConsentProvider';
import { useOrgChartDiagramReady } from './OrgChartDiagramReadyProvider';

const StyledBanner = styled.div`
  position: fixed;
  inset: auto 16px 16px 16px;
  z-index: 300;
  max-width: 560px;
  margin: 0 auto;
  padding: 20px;
  border-radius: 16px;
  background: #141414;
  color: #fff;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.35);

  @media (min-width: 810px) {
    left: 24px;
    right: auto;
    margin: 0;
  }
`;

const StyledTitle = styled.h2`
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
`;

const StyledCopy = styled.p`
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.55;
  color: rgba(255, 255, 255, 0.82);
`;

const StyledLink = styled(Link)`
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 2px;
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const buttonStyles = `
  border-radius: 999px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
`;

const StyledPrimaryButton = styled.button`
  ${buttonStyles}
  border: none;
  background: #fff;
  color: #141414;
`;

const StyledSecondaryButton = styled.button`
  ${buttonStyles}
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: transparent;
  color: #fff;
`;

const StyledPreferences = styled.div`
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const StyledPreferenceRow = styled.label`
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.9);
`;

const StyledPreferenceTitle = styled.div`
  font-weight: 600;
`;

const StyledPreferenceDescription = styled.div`
  color: rgba(255, 255, 255, 0.72);
`;

export const CookieConsentBanner = () => {
  const {
    consent,
    isResolved,
    isPreferencesOpen,
    closePreferences,
    openPreferences,
    saveConsent,
  } = useCookieConsent();
  const { shouldDeferCookieBanner } = useOrgChartDiagramReady();
  const [customCategories, setCustomCategories] =
    useState<PrivacyConsentCategories>(
      consent?.categories ?? DEFAULT_REJECT_CONSENT_CATEGORIES,
    );

  if (isResolved && !isPreferencesOpen) {
    return null;
  }

  if (shouldDeferCookieBanner && !isPreferencesOpen) {
    return null;
  }

  const handleSaveCustom = async () => {
    await saveConsent('custom', customCategories);
  };

  return (
    <StyledBanner role="dialog" aria-labelledby="cookie-consent-title">
      <StyledTitle id="cookie-consent-title">We value your privacy</StyledTitle>
      <StyledCopy>
        We use cookies to enhance your browsing experience, analyze traffic, and
        provide support chat. You can accept all, reject non-essential cookies,
        or customize your choices. Read our{' '}
        <StyledLink href="/legal/privacy">Privacy Policy</StyledLink>.
      </StyledCopy>

      {isPreferencesOpen && (
        <StyledPreferences>
          <StyledPreferenceRow>
            <input type="checkbox" checked disabled readOnly />
            <div>
              <StyledPreferenceTitle>Necessary</StyledPreferenceTitle>
              <StyledPreferenceDescription>
                Required for core site functionality.
              </StyledPreferenceDescription>
            </div>
          </StyledPreferenceRow>
          <StyledPreferenceRow>
            <input
              type="checkbox"
              checked={customCategories.analytics}
              onChange={(event) =>
                setCustomCategories((current) => ({
                  ...current,
                  analytics: event.target.checked,
                }))
              }
            />
            <div>
              <StyledPreferenceTitle>Analytics</StyledPreferenceTitle>
              <StyledPreferenceDescription>
                Helps us understand how visitors use the site (Google Analytics,
                Mixpanel).
              </StyledPreferenceDescription>
            </div>
          </StyledPreferenceRow>
          <StyledPreferenceRow>
            <input
              type="checkbox"
              checked={customCategories.functional}
              onChange={(event) =>
                setCustomCategories((current) => ({
                  ...current,
                  functional: event.target.checked,
                }))
              }
            />
            <div>
              <StyledPreferenceTitle>Support chat</StyledPreferenceTitle>
              <StyledPreferenceDescription>
                Enables the live chat widget so you can talk to our team.
              </StyledPreferenceDescription>
            </div>
          </StyledPreferenceRow>
        </StyledPreferences>
      )}

      <StyledActions>
        {!isPreferencesOpen ? (
          <>
            <StyledPrimaryButton
              type="button"
              onClick={() => saveConsent('accept_all')}
            >
              Accept all
            </StyledPrimaryButton>
            <StyledSecondaryButton
              type="button"
              onClick={() => saveConsent('reject_all')}
            >
              Reject non-essential
            </StyledSecondaryButton>
            <StyledSecondaryButton type="button" onClick={openPreferences}>
              Customize
            </StyledSecondaryButton>
          </>
        ) : (
          <>
            <StyledPrimaryButton type="button" onClick={handleSaveCustom}>
              Save preferences
            </StyledPrimaryButton>
            <StyledSecondaryButton
              type="button"
              onClick={() => {
                setCustomCategories(DEFAULT_ACCEPT_ALL_CONSENT_CATEGORIES);
                closePreferences();
              }}
            >
              Cancel
            </StyledSecondaryButton>
          </>
        )}
      </StyledActions>
    </StyledBanner>
  );
};
