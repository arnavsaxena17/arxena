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
  inset: auto 8px 8px 8px;
  z-index: 300;
  max-width: 420px;
  margin: 0 auto;
  padding: 8px 10px;
  border-radius: 8px;
  background: #141414;
  color: #fff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.3);

  @media (min-width: 810px) {
    left: 12px;
    right: auto;
    margin: 0;
  }
`;

const StyledCopy = styled.p`
  margin: 0 0 6px;
  font-size: 11px;
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.82);
`;

const StyledLink = styled(Link)`
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 1px;
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const buttonStyles = `
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
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
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.16);
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StyledPreferenceRow = styled.label`
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 11px;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.9);
`;

const StyledPreferenceTitle = styled.span`
  font-weight: 600;
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
      <StyledCopy id="cookie-consent-title">
        We use cookies for analytics.{' '}
        <StyledLink href="/legal/privacy">Privacy</StyledLink>
      </StyledCopy>

      {isPreferencesOpen && (
        <StyledPreferences>
          <StyledPreferenceRow>
            <input type="checkbox" checked disabled readOnly />
            <StyledPreferenceTitle>Necessary</StyledPreferenceTitle>
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
            <StyledPreferenceTitle>Analytics</StyledPreferenceTitle>
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
              Accept
            </StyledPrimaryButton>
            <StyledSecondaryButton
              type="button"
              onClick={() => saveConsent('reject_all')}
            >
              Reject
            </StyledSecondaryButton>
            <StyledSecondaryButton type="button" onClick={openPreferences}>
              Customize
            </StyledSecondaryButton>
          </>
        ) : (
          <>
            <StyledPrimaryButton type="button" onClick={handleSaveCustom}>
              Save
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
