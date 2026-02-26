'use client';

import styled from '@emotion/styled';

import { Logo } from '@/app/_components/ui/layout/Logo';
import { HomepageSearch } from './HomepageSearch';

const StyledHero = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 48px 24px;
  text-align: center;
`;

const StyledLogoWrapper = styled.div`
  margin-bottom: 24px;
`;

const StyledTitle = styled.h1`
  font-size: 2.5rem;
  font-weight: 600;
  margin: 0 0 24px 0;
  color: #000;
  line-height: 1.2;

  @media (max-width: 809px) {
    font-size: 1.75rem;
  }
`;

const StyledSearchWrapper = styled.div`
  width: 100%;
  max-width: 560px;
  margin: 0 auto 32px;
`;

const StyledAuthLinks = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
  margin-top: 24px;
`;

const StyledLink = styled.a`
  color: #000;
  text-decoration: none;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #e5e5e5;
  transition: background 0.15s ease;

  &:hover {
    background: #f5f5f5;
  }
`;

export const HomepageHero = () => {
  return (
    <StyledHero>
      <StyledLogoWrapper>
        <Logo variant="hero" />
      </StyledLogoWrapper>
      <StyledTitle>Search any company&apos;s org chart</StyledTitle>
      <StyledSearchWrapper>
        <HomepageSearch />
      </StyledSearchWrapper>
      <StyledAuthLinks>
        <StyledLink href="https://app.arxena.com/sign-up">Sign up</StyledLink>
        <StyledLink href="https://app.arxena.com/sign-in">Log in</StyledLink>
      </StyledAuthLinks>
    </StyledHero>
  );
};
