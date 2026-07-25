'use client';

import styled from '@emotion/styled';
import Link from 'next/link';

import { MarketingDetailPage } from '@/lib/marketing-site-pages';

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

const StyledLead = styled.p`
  font-size: 18px;
  line-height: 1.65;
  color: #474747;
  margin: 0 0 28px 0;
`;

const StyledBulletsTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #141414;
`;

const StyledList = styled.ul`
  margin: 0;
  padding-left: 22px;
  color: #474747;
  font-size: 17px;
  line-height: 1.65;
`;

const StyledLi = styled.li`
  margin-bottom: 12px;
`;

const StyledSegments = styled.p`
  font-size: 16px;
  line-height: 1.6;
  color: #818181;
  margin: 36px 0 0 0;
  padding-top: 28px;
  border-top: 1px solid rgba(20, 20, 20, 0.08);
`;

const StyledCtas = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 36px;
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

type MarketingDetailContentProps = {
  page: MarketingDetailPage;
  backHref: string;
  backLabel: string;
  signUpUrl: string;
};

export const MarketingDetailContent = ({
  page,
  backHref,
  backLabel,
  signUpUrl,
}: MarketingDetailContentProps) => {
  return (
    <StyledSection>
      <StyledBack href={backHref}>{backLabel}</StyledBack>
      <StyledHeadline>{page.headline}</StyledHeadline>
      <StyledLead>{page.lead}</StyledLead>
      <StyledBulletsTitle>
        {page.bulletsTitle ?? 'What you can do'}
      </StyledBulletsTitle>
      <StyledList>
        {page.bullets.map((item) => (
          <StyledLi key={item}>{item}</StyledLi>
        ))}
      </StyledList>
      {page.segmentsNote && (
        <StyledSegments>{page.segmentsNote}</StyledSegments>
      )}
      <StyledCtas>
        <StyledCtaPrimary href={signUpUrl}>Get started</StyledCtaPrimary>
        <StyledCtaSecondary href="/contact#schedule">
          Book a call
        </StyledCtaSecondary>
      </StyledCtas>
    </StyledSection>
  );
};
