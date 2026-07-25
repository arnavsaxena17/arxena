'use client';

import styled from '@emotion/styled';
import Link from 'next/link';

const StyledSection = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px 96px;
`;

const StyledBack = styled(Link)`
  display: inline-flex;
  align-items: center;
  font-size: 15px;
  color: #818181;
  text-decoration: none;
  margin-bottom: 32px;

  &:hover {
    color: #141414;
    text-decoration: underline;
  }
`;

const StyledHeadline = styled.h1`
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 600;
  line-height: 1.15;
  margin: 0 0 20px 0;
  color: #141414;
`;

const StyledBody = styled.p`
  font-size: 18px;
  line-height: 1.65;
  color: #474747;
  margin: 0 0 20px 0;
`;

const StyledCtas = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 32px;
`;

const StyledCtaPrimary = styled.a`
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 20px;
  background-color: #000;
  color: #fff;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  font-size: 15px;

  &:hover {
    color: #9e9e9e;
  }
`;

const StyledCtaSecondary = styled(Link)`
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 20px;
  border: 1px solid rgba(20, 20, 20, 0.2);
  color: #141414;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  font-size: 15px;

  &:hover {
    background-color: #fafafa;
  }
`;

type ResourceSubpageContentProps = {
  headline: string;
  paragraphs: string[];
  signUpUrl: string;
  primaryCtaHref: string;
  primaryCtaLabel: string;
};

export const ResourceSubpageContent = ({
  headline,
  paragraphs,
  signUpUrl,
  primaryCtaHref,
  primaryCtaLabel,
}: ResourceSubpageContentProps) => {
  return (
    <StyledSection>
      <StyledBack href="/resources">← Resources</StyledBack>
      <StyledHeadline>{headline}</StyledHeadline>
      {paragraphs.map((p, index) => (
        <StyledBody key={index}>{p}</StyledBody>
      ))}
      <StyledCtas>
        <StyledCtaPrimary href={primaryCtaHref}>
          {primaryCtaLabel}
        </StyledCtaPrimary>
        <StyledCtaSecondary href={signUpUrl}>
          Create free account
        </StyledCtaSecondary>
      </StyledCtas>
    </StyledSection>
  );
};
