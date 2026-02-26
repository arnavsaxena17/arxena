'use client';

import styled from '@emotion/styled';
import Link from 'next/link';

import { Logo } from '@/app/_components/ui/layout/Logo';

const StyledHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px 24px;
  background: #fff;
  border-bottom: 1px solid rgba(20, 20, 20, 0.08);
  flex-shrink: 0;
  z-index: 10;

  @media (max-width: 809px) {
    padding: 12px 16px;
  }
`;

const StyledNav = styled.nav`
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

export const OrgChartHeader = () => {
  return (
    <StyledHeader>
      <StyledNav>
        <Logo />
        <StyledNavLink href="/story">Story</StyledNavLink>
        <StyledNavLink href="/pricing">Pricing</StyledNavLink>
        <StyledNavLink href="/releases">Releases</StyledNavLink>
      </StyledNav>
      <StyledAuthLinks>
        <StyledSignIn href="https://app.arxena.com/sign-in">
          Sign in
        </StyledSignIn>
        <StyledSignUp href="https://app.arxena.com/sign-up">
          Sign up
        </StyledSignUp>
      </StyledAuthLinks>
    </StyledHeader>
  );
};
