'use client';

import styled from '@emotion/styled';
import { IconHierarchy2 } from '@tabler/icons-react';
import Link from 'next/link';

import { useFreeTrialCta } from '@/app/_components/free-trial/useFreeTrialCta';
import { OrgChartSearch } from '@/app/_components/orgchart/OrgChartSearch';
import { HeaderNavDropdown } from '@/app/_components/ui/layout/header/HeaderNavDropdown';
import { Logo } from '@/app/_components/ui/layout/Logo';
import { trackGA4Event } from '@/lib/analytics';
import { FREE_TRIAL_CTA_LABEL } from '@/lib/free-trial-flow';
import { PRODUCT_PAGES, SOLUTION_PAGES } from '@/lib/marketing-site-pages';
import { trackWebsiteEvent } from '@/lib/mixpanel';
import {
  SUPPORTED_PRICING_CURRENCIES,
  SupportedPricingCurrency,
} from '@/lib/pricing-currency-helpers';

const StyledDesktopNav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid rgba(20, 20, 20, 0.08);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 50;
  overflow: visible;

  @media (max-width: 809px) {
    display: none;
  }
`;

const StyledNav = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  overflow: visible;
`;

const StyledNavLink = styled(Link)`
  color: rgb(71, 71, 71);
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 15px;

  &:hover {
    background-color: #f1f1f1;
  }
`;

const StyledNavLinkHiddenOnTablet = styled(StyledNavLink)`
  @media (min-width: 810px) and (max-width: 1199px) {
    display: none;
  }
`;

const StyledSearchWrapper = styled.div`
  flex: 1;
  min-width: 200px;
  max-width: 360px;
  margin: 0 16px;
`;

const StyledAuthLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledCurrencySelect = styled.select`
  border: 1px solid rgba(20, 20, 20, 0.12);
  border-radius: 8px;
  color: rgb(71, 71, 71);
  font-size: 13px;
  height: 36px;
  padding: 0 8px;
  background: #fff;
`;

const StyledSignIn = styled.a`
  color: rgb(71, 71, 71);
  text-decoration: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 15px;

  &:hover {
    background-color: #f1f1f1;
  }
`;

const headerSignUpStyles = `
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 16px;
  background-color: #000;
  color: #fff;
  border-radius: 8px;
  font-weight: 500;
  font-size: 15px;
  transition: color 0.15s ease;
  cursor: pointer;

  &:hover {
    color: #9e9e9e;
  }
`;

const StyledSignUp = styled.a`
  ${headerSignUpStyles}
  text-decoration: none;
`;

const StyledSignUpButton = styled.button`
  ${headerSignUpStyles}
  border: none;
  font-family: inherit;
`;

type HeaderDesktopProps = {
  showSearch?: boolean;
  showCurrencySelector?: boolean;
  signInUrl: string;
  signUpUrl: string;
  currency: SupportedPricingCurrency;
  onCurrencyChange: (currency: SupportedPricingCurrency) => void;
};

export const HeaderDesktop = ({
  showSearch = true,
  showCurrencySelector = true,
  signInUrl,
  signUpUrl,
  currency,
  onCurrencyChange,
}: HeaderDesktopProps) => {
  const { isFreeTrialFlow, onCtaClick } = useFreeTrialCta({
    source: 'header',
    legacyGa4Props: { source: 'header' },
  });

  return (
    <StyledDesktopNav>
      <StyledNav>
        <Logo />
        <StyledNavLink href="/story">Story</StyledNavLink>
        <HeaderNavDropdown
          href="/solutions"
          label="Solutions"
          items={SOLUTION_PAGES}
        />
        <HeaderNavDropdown
          href="/products"
          label="Products"
          items={PRODUCT_PAGES}
        />
        {/* <StyledNavLinkHiddenOnTablet href="/resources">
          Resources
        </StyledNavLinkHiddenOnTablet> */}
        {/* <StyledNavLink href="/team">Team</StyledNavLink> */}
        {/* <StyledNavLink href="/contact">Contact</StyledNavLink> */}
        <StyledNavLink href="/pricing">Pricing</StyledNavLink>
        {/* <StyledNavLinkHiddenOnTablet
          href="/engage"
          aria-label="Engage — WhatsApp & LinkedIn"
        >
          Engage
        </StyledNavLinkHiddenOnTablet> */}
        <StyledNavLinkHiddenOnTablet href="/chrome-extension">
          Chrome extension
        </StyledNavLinkHiddenOnTablet>
      </StyledNav>
      {showSearch && (
        <StyledSearchWrapper>
          <OrgChartSearch
            placeholder="Search any company"
            startIcon={<IconHierarchy2 size={20} />}
          />
        </StyledSearchWrapper>
      )}
      <StyledAuthLinks>
        {showCurrencySelector && (
          <StyledCurrencySelect
            aria-label="Select currency"
            value={currency}
            onChange={(event) =>
              onCurrencyChange(event.target.value as SupportedPricingCurrency)
            }
          >
            {SUPPORTED_PRICING_CURRENCIES.map((supportedCurrency) => (
              <option key={supportedCurrency} value={supportedCurrency}>
                {supportedCurrency}
              </option>
            ))}
          </StyledCurrencySelect>
        )}
        <StyledSignIn
          href={signInUrl}
          onClick={() => {
            trackGA4Event('sign_in_click', { source: 'header' });
            trackWebsiteEvent('sign_in_click', { source: 'header' });
          }}
        >
          Sign in
        </StyledSignIn>
        {isFreeTrialFlow ? (
          <StyledSignUpButton type="button" onClick={onCtaClick}>
            {FREE_TRIAL_CTA_LABEL}
          </StyledSignUpButton>
        ) : (
          <StyledSignUp href={signUpUrl} onClick={onCtaClick}>
            Sign up
          </StyledSignUp>
        )}
      </StyledAuthLinks>
    </StyledDesktopNav>
  );
};
