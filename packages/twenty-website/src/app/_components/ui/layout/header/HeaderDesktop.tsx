'use client';

import styled from '@emotion/styled';
import { IconHierarchy2 } from '@tabler/icons-react';
import Link from 'next/link';

import { OrgChartSearch } from '@/app/_components/orgchart/OrgChartSearch';
import { Logo } from '@/app/_components/ui/layout/Logo';
import { trackGA4Event } from '@/lib/analytics';
import { trackWebsiteEvent } from '@/lib/mixpanel';

const StyledDesktopNav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid rgba(20, 20, 20, 0.08);
  flex-shrink: 0;
  z-index: 10;

  @media (max-width: 809px) {
    display: none;
  }
`;

const StyledNav = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
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

type HeaderDesktopProps = {
  showSearch?: boolean;
  signInUrl: string;
  signUpUrl: string;
};

export const HeaderDesktop = ({
  showSearch = true,
  signInUrl,
  signUpUrl,
}: HeaderDesktopProps) => {
  return (
    <StyledDesktopNav>
      <StyledNav>
        <Logo />
        <StyledNavLink href="/story">Story</StyledNavLink>
        <StyledNavLink href="/team">Team</StyledNavLink>
        <StyledNavLink href="/pricing">Pricing</StyledNavLink>
        <StyledNavLink href="/engage">Engage</StyledNavLink>
      </StyledNav>
      {showSearch && (
        <StyledSearchWrapper>
          <OrgChartSearch
            placeholder="Search any company's org chart"
            startIcon={<IconHierarchy2 size={20} />}
          />
        </StyledSearchWrapper>
      )}
      <StyledAuthLinks>
        <StyledSignIn
          href={signInUrl}
          onClick={() => {
            trackGA4Event('sign_in_click', { source: 'header' });
            trackWebsiteEvent('sign_in_click', { source: 'header' });
          }}
        >
          Sign in
        </StyledSignIn>
        <StyledSignUp
          href={signUpUrl}
          onClick={() => {
            trackGA4Event('sign_up_click', { source: 'header' });
            trackWebsiteEvent('sign_up_click', { source: 'header' });
          }}
        >
          Sign up
        </StyledSignUp>
      </StyledAuthLinks>
    </StyledDesktopNav>
  );
};
