'use client';

import styled from '@emotion/styled';
import { IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
import React from 'react';

import type { SupportedPricingCurrency } from '@/lib/pricing-currency-helpers';
import {
  convertPricingAmountSubunits,
  getPricingCurrencySymbol,
} from '@/lib/pricing-currency-helpers';
import {
  PRICING_MARKETING_HERO_HEADLINE,
  PRICING_MARKETING_HERO_SUBHEADLINE,
  PRICING_PLANS,
  creditPackPricingFootnote,
  getInheritedFeatures,
  type PricingPlan,
  type PricingPlanId,
  type PricingPlanTier,
} from 'twenty-shared';

const StyledSection = styled.section`
  max-width: 1280px;
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px;
  margin-bottom: 48px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const StyledCard = styled.div`
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
`;

const StyledCardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const StyledCardLabel = styled.div`
  align-items: center;
  display: flex;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #818181;
`;

const StyledCardEmoji = styled.span`
  font-size: 18px;
`;

const StyledCardTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #141414;
  line-height: 1.25;
`;

const StyledCardTagline = styled.p`
  font-size: 14px;
  color: #6b6b6b;
  margin: 0;
  line-height: 1.45;
`;

const StyledMapTypePill = styled.div`
  align-self: flex-start;
  background: #fff;
  border: 1px solid rgba(20, 20, 20, 0.1);
  border-radius: 999px;
  color: #474747;
  font-size: 12px;
  padding: 4px 10px;
`;

const StyledTierSelectWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const StyledTierSelectLabel = styled.label`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #818181;
`;

const StyledTierSelect = styled.select`
  appearance: none;
  background: #fff;
  border: 1px solid rgba(20, 20, 20, 0.12);
  border-radius: 8px;
  color: #141414;
  font-size: 14px;
  padding: 10px 12px;
  width: 100%;
`;

const StyledPriceBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StyledPrice = styled.div`
  font-size: 2.25rem;
  font-weight: 700;
  color: #141414;
  line-height: 1.05;
`;

const StyledPriceUnit = styled.span`
  font-size: 15px;
  font-weight: 400;
  color: #818181;
`;

const StyledPriceFinePrint = styled.div`
  font-size: 13px;
  color: #818181;
`;

const StyledCreditsBlock = styled.div`
  background: #fff;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
`;

const StyledCreditsEquivalents = styled.div`
  color: #6b6b6b;
  font-size: 13px;
  line-height: 1.5;
`;

const StyledFeatureList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
`;

const StyledFeatureItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  color: #474747;
  line-height: 1.5;
`;

const StyledInheritedLine = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: #141414;
`;

const StyledCheckIcon = styled(IconCheck)`
  flex-shrink: 0;
  margin-top: 2px;
  color: #141414;
`;

const StyledCtaStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
`;

const StyledCtaPrimary = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  background-color: #000;
  color: #fff;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  font-size: 14px;
  transition: color 0.15s ease;

  &:hover {
    color: #b3b3b3;
  }
`;

const StyledCtaSecondary = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  background: transparent;
  border: 1px solid rgba(20, 20, 20, 0.12);
  color: #141414;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  font-size: 14px;
  transition: background-color 0.15s ease;

  &:hover {
    background: #f1f1f1;
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
  signUpUrl: string;
  currency: SupportedPricingCurrency;
};

const PLAN_ORDER: PricingPlanId[] = [
  'sales',
  'recruitment',
  'corporate',
  'investment',
];

const REVEAL_COST_EMAIL = 1;
const REVEAL_COST_PHONE = 5;

const formatMoneyMajor = (subunits: number): string =>
  Math.round(subunits / 100).toLocaleString();

type PlanCardState = Record<PricingPlanId, number>;

const buildInitialTierState = (): PlanCardState => {
  return PLAN_ORDER.reduce((acc, planId) => {
    acc[planId] = PRICING_PLANS[planId].minMaps;
    return acc;
  }, {} as PlanCardState);
};

const findTier = (plan: PricingPlan, maps: number): PricingPlanTier => {
  const exact = plan.tiers.find((t) => t.maps === maps);
  return exact ?? plan.tiers[0];
};

export const PricingContent = ({
  signUpUrl,
  currency,
}: PricingContentProps) => {
  const [selectedTiers, setSelectedTiers] = React.useState<PlanCardState>(
    () => buildInitialTierState(),
  );

  React.useEffect(() => {
    setSelectedTiers((previous) => {
      let changed = false;
      const next = { ...previous };
      for (const planId of PLAN_ORDER) {
        const plan = PRICING_PLANS[planId];
        const raw = next[planId];
        if (raw !== undefined && !plan.tiers.some((t) => t.maps === raw)) {
          next[planId] = plan.minMaps;
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, []);

  return (
    <StyledSection>
      <StyledHeadline>{PRICING_MARKETING_HERO_HEADLINE}</StyledHeadline>
      <StyledHeadlineSub>
        {PRICING_MARKETING_HERO_SUBHEADLINE.split('\n').map((line: string, index: number) => (
          <React.Fragment key={index}>
            {index > 0 ? <br /> : null}
            {line}
          </React.Fragment>
        ))}
      </StyledHeadlineSub>
 

      <StyledCardsGrid>
        {PLAN_ORDER.map((planId) => {
          const plan = PRICING_PLANS[planId];
          const selectedMaps = selectedTiers[planId];
          const tier = findTier(plan, selectedMaps);
          const explicit = tier.pricesSubunits[currency];
          const priceSubunits =
            typeof explicit === 'number' && explicit > 0
              ? explicit
              : convertPricingAmountSubunits(
                  tier.pricesSubunits.GBP,
                  'GBP',
                  currency,
                );
          const totalCredits = tier.credits;
          const emailEquivalent = Math.floor(totalCredits / REVEAL_COST_EMAIL);
          const phoneEquivalent = Math.floor(totalCredits / REVEAL_COST_PHONE);
          const inherited = getInheritedFeatures(planId);
          const totalSubunits = priceSubunits * tier.maps;

          return (
            <StyledCard key={planId}>
              <StyledCardHeader>
                <StyledCardLabel>
                  <StyledCardEmoji>{plan.icon}</StyledCardEmoji>
                  {plan.label}
                </StyledCardLabel>
                <StyledCardTitle>{plan.tagline}</StyledCardTitle>
                <StyledCardTagline>{plan.mapTypeLabel}</StyledCardTagline>
              </StyledCardHeader>

              <StyledMapTypePill>
                Map type · {plan.mapType}
              </StyledMapTypePill>

              <StyledTierSelectWrap>
                <StyledTierSelectLabel htmlFor={`tier-${planId}`}>
                  Volume
                </StyledTierSelectLabel>
                <StyledTierSelect
                  id={`tier-${planId}`}
                  value={selectedMaps}
                  onChange={(event) => {
                    const v = parseInt(event.target.value, 10);
                    setSelectedTiers((prev) => ({
                      ...prev,
                      [planId]: Number.isNaN(v) ? plan.minMaps : v,
                    }));
                  }}
                >
                  {plan.tiers.map((t) => (
                    <option key={t.maps} value={t.maps}>
                      {t.maps} Live Org Charts
                    </option>
                  ))}
                </StyledTierSelect>
              </StyledTierSelectWrap>

              <StyledPriceBlock>
                <StyledPrice>
                  {getPricingCurrencySymbol(currency)}
                  {formatMoneyMajor(priceSubunits)}
                  <StyledPriceUnit>
                    {' '}
                    / map
                  </StyledPriceUnit>
                </StyledPrice>
                <StyledPriceFinePrint>
                  Total:{' '}
                  {getPricingCurrencySymbol(currency)}
                  {formatMoneyMajor(totalSubunits)} for {tier.maps} maps
                </StyledPriceFinePrint>
              </StyledPriceBlock>

              <StyledCreditsBlock>
                <StyledCreditsEquivalents>
                  Includes {emailEquivalent.toLocaleString()} email credits +{' '}
                  {phoneEquivalent.toLocaleString()} phone reveals + 1000 AI Conversations Credits
                </StyledCreditsEquivalents>
              </StyledCreditsBlock>

              {inherited.inheritedFromLabel && (
                <StyledInheritedLine>
                  Everything in {inherited.inheritedFromLabel}, plus:
                </StyledInheritedLine>
              )}

              <StyledFeatureList>
                {plan.ownFeatures.map((feature) => (
                  <StyledFeatureItem key={feature}>
                    <StyledCheckIcon size={18} strokeWidth={2.5} />
                    {feature}
                  </StyledFeatureItem>
                ))}
              </StyledFeatureList>

              <StyledCtaStack>
                <StyledCtaPrimary href={signUpUrl}>
                  Start for free
                </StyledCtaPrimary>
                <StyledCtaSecondary
                  href="https://calendly.com/arxena/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Talk to sales
                </StyledCtaSecondary>
           
              </StyledCtaStack>
            </StyledCard>
          );
        })}
      </StyledCardsGrid>

      <StyledRoiSection>
        <StyledRoiTitle>
          Understand the lay of the org before your first message.
        </StyledRoiTitle>
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
