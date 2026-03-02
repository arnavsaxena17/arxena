'use client';

import styled from '@emotion/styled';
import { IconHierarchy2 } from '@tabler/icons-react';
import Link from 'next/link';
import { useState } from 'react';

import { OrgChartSearch } from '@/app/_components/orgchart/OrgChartSearch';
import { Logo } from '@/app/_components/ui/layout/Logo';
import { trackGA4Event } from '@/lib/analytics';
import { trackWebsiteEvent } from '@/lib/mixpanel';

import { LogoContainer, NavOpen } from './styled';

const StyledMobileMenu = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;

  @media (min-width: 810px) {
    display: none;
  }
`;

const StyledMobileNav = styled.nav`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
  position: relative;
  background-color: white;
  border-bottom: 1px solid rgba(20, 20, 20, 0.08);
  height: 64px;
  width: 100%;
  z-index: 10;
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

const HamburgerContainer = styled.div`
  height: 44px;
  width: 44px;
  position: relative;

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
  signInUrl: string;
  signUpUrl: string;
};

export const HeaderMobile = ({
  showSearch = true,
  signInUrl,
  signUpUrl,
}: HeaderMobileProps) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <StyledMobileMenu>
      <StyledMobileNav>
        <LogoContainer>
          <Logo />
        </LogoContainer>
        <HamburgerContainer>
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
          <StyledNavLink href="/team">Team</StyledNavLink>
          <StyledNavLink href="/pricing">Pricing</StyledNavLink>
          <StyledNavLink href="/engage">Engage</StyledNavLink>
          {showSearch && (
            <StyledSearchWrapper>
              <OrgChartSearch
                placeholder="Search any company's org chart"
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
