'use client';

import styled from '@emotion/styled';
import { IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
import React from 'react';

import {
  type CreditPack,
  type PricingIntent,
  CREDIT_PACKS_BY_INTENT,
  creditPackPricingFootnote,
} from 'twenty-shared';

const StyledSection = styled.section`
  max-width: 1160px;
  margin: 0 auto;
  padding: 64px 24px 96px;
`;

const StyledHeadline = styled.h1`
  font-size: clamp(2rem, 4vw, 3rem);
  font-weight: 600;
  line-height: 1.2;
  margin: 0 0 16px 0;
  text-align: center;
  color: #141414;
`;

const StyledHeadlineSub = styled.p`
  font-size: 18px;
  color: #818181;
  margin: 0 0 48px 0;
  text-align: center;
`;

const StyledCardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  justify-content: center;
  gap: 32px;
  margin-bottom: 48px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const StyledIntentTabs = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin: 24px 0 32px;
  padding: 6px;
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 999px;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
`;

const StyledIntentTab = styled.button<{ isActive: boolean }>`
  appearance: none;
  background: ${({ isActive }) => (isActive ? '#fff' : 'transparent')};
  border: 0;
  border-radius: 999px;
  color: #141414;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  padding: 10px 14px;
  transition: background-color 0.15s ease, color 0.15s ease;

  &:hover {
    background: ${({ isActive }) => (isActive ? '#fff' : '#f1f1f1')};
  }
`;

const StyledCard = styled.div`
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
  padding: 32px;
  display: flex;
  flex-direction: column;
`;

const StyledCardTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #141414;
`;

const StyledPrice = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: #141414;
  margin-bottom: 4px;
`;

const _StyledPriceUnit = styled.span`
  font-size: 16px;
  font-weight: 400;
  color: #818181;
`;

const StyledCredits = styled.div`
  font-size: 15px;
  color: #474747;
  margin-bottom: 24px;
`;

const StyledFeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 32px 0;
  flex: 1;
`;

const StyledFeatureItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 15px;
  color: #474747;
  margin-bottom: 12px;
  line-height: 1.5;
`;

const StyledCheckIcon = styled(IconCheck)`
  flex-shrink: 0;
  margin-top: 2px;
  color: #141414;
`;

const StyledCtaButton = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
  background-color: #000;
  color: #fff;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  font-size: 15px;
  transition: color 0.15s ease;

  &:hover {
    color: #b3b3b3;
  }
`;

const StyledRoiSection = styled.div`
  text-align: center;
  padding: 32px 24px;
  background: #fafafa;
  border-radius: 12px;
  margin-bottom: 48px;
  border: 1px solid rgba(20, 20, 20, 0.08);
`;

const StyledRoiTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: #141414;
`;

const StyledRoiText = styled.p`
  font-size: 15px;
  color: #474747;
  margin: 0;
  line-height: 1.6;
`;

const StyledHelpSection = styled.div`
  text-align: center;
  padding-top: 32px;
  border-top: 1px solid rgba(20, 20, 20, 0.08);
`;

const StyledHelpTitle = styled.p`
  font-size: 18px;
  font-weight: 500;
  color: #141414;
  margin: 0 0 16px 0;
`;

const StyledHelpLink = styled.a`
  color: #474747;
  text-decoration: underline;
  font-size: 15px;

  &:hover {
    color: #141414;
  }
`;

const StyledEngageLink = styled(Link)`
  color: #474747;
  text-decoration: underline;
  font-size: 15px;

  &:hover {
    color: #141414;
  }
`;

type PricingContentProps = {
  signInUrl: string;
  signUpUrl: string;
};

export const PricingContent = ({ signUpUrl }: PricingContentProps) => {
  const [intent, setIntent] = React.useState<PricingIntent>('SALES');

  const packs = CREDIT_PACKS_BY_INTENT[intent];
  const intentCopy: Record<PricingIntent, { headline: string; sub: string }> = {
    SALES: {
      headline: "Pipeline-grade org intelligence for Sales / ABM",
      sub:
        "Map buying committees, champions, and blockers across target accounts — then reveal/export only what matters.",
    },
    INVESTING: {
      headline: "Deal diligence org intelligence for PE / VC",
      sub:
        "For the most informed first call with your target companies. Diligence faster, monitor portfolios, and benchmark management teams.",
    },
    RECRUITING: {
      headline: "Org intelligence for Recruiting",
      sub:
        "Map teams, find the right candidates, and build shortlists with org-chart context before the recruiters start calling.",
    },
  };

  return (
    <StyledSection>
      <StyledHeadline>{intentCopy[intent].headline}</StyledHeadline>
      <StyledHeadlineSub>{intentCopy[intent].sub}</StyledHeadlineSub>

      <StyledIntentTabs>
        <StyledIntentTab
          type="button"
          isActive={intent === 'INVESTING'}
          onClick={() => setIntent('INVESTING')}
        >
          PE / VC
        </StyledIntentTab>
        <StyledIntentTab
          type="button"
          isActive={intent === 'SALES'}
          onClick={() => setIntent('SALES')}
        >
          Sales / ABM
        </StyledIntentTab>
        <StyledIntentTab
          type="button"
          isActive={intent === 'RECRUITING'}
          onClick={() => setIntent('RECRUITING')}
        >
          Recruiting
        </StyledIntentTab>
      </StyledIntentTabs>

      <StyledCardsGrid>
        {packs.map((pack: CreditPack) => (
          <StyledCard key={pack.name}>
            <StyledCardTitle>{pack.name}</StyledCardTitle>
            <StyledPrice>
              {pack.currency === 'GBP' ? '£' : '$'}
              {(pack.amountSubunits / 100).toLocaleString()}
            </StyledPrice>
            <StyledCredits>{pack.creditsDisplay}</StyledCredits>
            <StyledFeatureList>
              {pack.features.map((feature: string) => (
                <StyledFeatureItem key={feature}>
                  <StyledCheckIcon size={20} strokeWidth={2.5} />
                  {feature}
                </StyledFeatureItem>
              ))}
            </StyledFeatureList>
            <StyledCtaButton href={signUpUrl}>Start for free</StyledCtaButton>
          </StyledCard>
        ))}
      </StyledCardsGrid>

      <StyledRoiSection>
        <StyledRoiTitle>
          Understand the lay of the org before your first message.
        </StyledRoiTitle>
        {/* <StyledRoiText>
          Most tools sell contacts without context. Arxena sells verified org
          structure first — then you reveal/export only the contacts you need.
        </StyledRoiText> */}
        <p style={{ margin: '16px 0 0 0', fontSize: 14, color: '#818181' }}>
          {creditPackPricingFootnote}
        </p>
      </StyledRoiSection>

      <StyledHelpSection>
        <p style={{ margin: '0 0 16px 0', fontSize: 15, color: '#474747' }}>
          Already have your org charts? Let our AI reach out to the right
          people.{' '}
          <StyledEngageLink href="/engage">
            Learn about Engagement →
          </StyledEngageLink>
        </p>
        <StyledHelpTitle>Need more information?</StyledHelpTitle>
        <p style={{ margin: '0 0 8px 0', color: '#818181', fontSize: 15 }}>
          Let&apos;s find the perfect solution for your organization.
        </p>
        <StyledHelpLink href="mailto:hello@arxena.com">
          Book a demo
        </StyledHelpLink>
      </StyledHelpSection>
    </StyledSection>
  );
};
