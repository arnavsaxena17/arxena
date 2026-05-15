'use client';

import styled from '@emotion/styled';
import { IconHierarchy2 } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import { OrgChartSearch } from '@/app/_components/orgchart/OrgChartSearch';
import { HeaderMobileNavDropdown } from '@/app/_components/ui/layout/header/HeaderNavDropdown';
import { Logo } from '@/app/_components/ui/layout/Logo';
import { trackGA4Event } from '@/lib/analytics';
import { PRODUCT_PAGES, SOLUTION_PAGES } from '@/lib/marketing-site-pages';
import { trackWebsiteEvent } from '@/lib/mixpanel';
import {
  SUPPORTED_PRICING_CURRENCIES,
  SupportedPricingCurrency,
} from '@/lib/pricing-currency-helpers';

import { LogoContainer, NavOpen } from './styled';

const StyledMobileMenu = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;

  @media (min-width: 810px) {
    display: none;
  }
`;

const StyledNavEmbeddedSearch = styled.div`
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
`;

const StyledMobileNav = styled.nav<{ $embedded?: boolean }>`
  display: flex;
  flex-direction: row;
  justify-content: ${({ $embedded }) =>
    $embedded ? 'flex-start' : 'space-between'};
  align-items: center;
  gap: ${({ $embedded }) => ($embedded ? '8px' : '0')};
  padding: 0 ${({ $embedded }) => ($embedded ? '10px' : '12px')};
  position: sticky;
  top: 0;
  background-color: white;
  border-bottom: 1px solid rgba(20, 20, 20, 0.08);
  height: ${({ $embedded }) => ($embedded ? '52px' : '64px')};
  width: 100%;
  z-index: 110;
`;

const StyledMobileLinkList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  width: 100%;
  padding: 0 24px;
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
  @media (min-width: 768px) and (max-width: 809px) {
    display: none;
  }
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

const StyledSignUp = styled.a`
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 16px;
  background-color: #000;
  color: #fff;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  font-size: 15px;
  transition: color 0.15s ease;

  &:hover {
    color: #9e9e9e;
  }
`;

const StyledSearchWrapper = styled.div`
  width: 100%;
  max-width: 360px;
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

const HamburgerContainer = styled.div<{ $embedded?: boolean }>`
  height: 44px;
  width: 44px;
  position: relative;
  flex-shrink: 0;
  ${({ $embedded }) => $embedded && 'margin-left: auto;'}

  input {
    cursor: pointer;
    height: 44px;
    width: 44px;
    opacity: 0;
    z-index: 1;
  }

  input:checked ~ div:first-of-type {
    transform: rotate(45deg) translate(7px);
  }

  input:checked ~ div:last-of-type {
    transform: rotate(-45deg) translate(7px);
  }
`;

const HamburgerLine = styled.div`
  position: absolute;
  left: calc(50% - 10px);
  width: 20px;
  height: 2px;
  border-radius: 10px;
  background-color: rgb(179, 179, 179);
  z-index: 0;
  transition: transform 0.5s ease-in-out;
`;

const HamburgerLine1 = styled(HamburgerLine)`
  top: calc(37.5% - 1px);
`;

const HamburgerLine2 = styled(HamburgerLine)`
  top: calc(62.5% - 1px);
`;

type HeaderMobileProps = {
  showSearch?: boolean;
  showCurrencySelector?: boolean;
  signInUrl: string;
  signUpUrl: string;
  currency: SupportedPricingCurrency;
  onCurrencyChange: (currency: SupportedPricingCurrency) => void;
  embeddedToolbar?: boolean;
};

export const HeaderMobile = ({
  showSearch = true,
  showCurrencySelector = true,
  signInUrl,
  signUpUrl,
  currency,
  onCurrencyChange,
  embeddedToolbar = false,
}: HeaderMobileProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <StyledMobileMenu>
      <StyledMobileNav $embedded={embeddedToolbar}>
        <LogoContainer>
          <Logo variant={embeddedToolbar ? 'compact' : 'header'} />
        </LogoContainer>
        {embeddedToolbar ? (
          <StyledNavEmbeddedSearch>
            <OrgChartSearch
              dense
              placeholder="Search any company's org chart"
              startIcon={<IconHierarchy2 size={16} />}
            />
          </StyledNavEmbeddedSearch>
        ) : null}
        <HamburgerContainer $embedded={embeddedToolbar}>
          <input type="checkbox" onChange={toggleMenu} checked={menuOpen} />
          <HamburgerLine1 />
          <HamburgerLine2 />
        </HamburgerContainer>
      </StyledMobileNav>
      <NavOpen
        style={{
          transform: `scaleY(${menuOpen ? '1' : '0'})`,
        }}
      >
        <StyledMobileLinkList>
          <StyledNavLink href="/story">Story</StyledNavLink>
          <HeaderMobileNavDropdown
            basePath="/solutions"
            label="Solutions"
            items={SOLUTION_PAGES}
            onItemNavigate={() => setMenuOpen(false)}
          />
          <HeaderMobileNavDropdown
            basePath="/products"
            label="Products"
            items={PRODUCT_PAGES}
            onItemNavigate={() => setMenuOpen(false)}
          />
          <StyledNavLinkHiddenOnTablet href="/resources">
            Resources
          </StyledNavLinkHiddenOnTablet>
          <StyledNavLink href="/contact">Contact</StyledNavLink>
          <StyledNavLink href="/pricing">Pricing</StyledNavLink>
          <StyledNavLinkHiddenOnTablet
            href="/engage"
            aria-label="Engage — WhatsApp & LinkedIn"
          >
            Engage
          </StyledNavLinkHiddenOnTablet>
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
          {showSearch && (
            <StyledSearchWrapper>
              <OrgChartSearch
                placeholder="Search any company"
                startIcon={<IconHierarchy2 size={20} />}
              />
            </StyledSearchWrapper>
          )}
          <StyledSignIn
            href={signInUrl}
            onClick={() => {
              trackGA4Event('sign_in_click', { source: 'header_mobile' });
              trackWebsiteEvent('sign_in_click', { source: 'header_mobile' });
            }}
          >
            Sign in
          </StyledSignIn>
          <StyledSignUp
            href={signUpUrl}
            onClick={() => {
              trackGA4Event('sign_up_click', { source: 'header_mobile' });
              trackWebsiteEvent('sign_up_click', { source: 'header_mobile' });
            }}
          >
            Sign up
          </StyledSignUp>
        </StyledMobileLinkList>
      </NavOpen>
    </StyledMobileMenu>
  );
};
