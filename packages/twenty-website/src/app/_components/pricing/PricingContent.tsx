'use client';

import styled from '@emotion/styled';
import { IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
import React from 'react';

import {
  SupportedPricingCurrency,
  getPricingCurrencySymbol,
} from '@/lib/pricing-currency-helpers';
import {
  FREEMIUM_PLAN_ORDER,
  FREEMIUM_PLANS,
  FREEMIUM_SEAT_OPTIONS,
  PRICING_CTA_START_FOR_FREE,
  PRICING_CTA_TALK_TO_SALES,
  PRICING_HELP_ENGAGEMENT_LEAD,
  PRICING_HELP_ENGAGEMENT_LINK_LABEL,
  PRICING_MARKETING_HERO_HEADLINE,
  PRICING_MARKETING_HERO_SUBHEADLINE,
  PRICING_MARKETING_ROI_HEADLINE,
  PRICING_PER_SEAT_MONTH_UNIT,
  PRICING_RECOMMENDED_FREEMIUM_PLAN_ID,
  PRICING_RECOMMENDED_PLAN_LABEL,
  PRICING_SEATS_LABEL,
  buildInitialFreemiumSeatsState,
  creditPackPricingFootnote,
  getFreemiumEntitlementsForSeats,
  getFreemiumMonthlyTotalSubunits,
  type FreemiumPlanId,
} from 'twenty-shared/constants';

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
  margin: 0 auto 48px;
  max-width: 1120px;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const StyledCard = styled.div<{ $isRecommended: boolean }>`
  background: #fafafa;
  border: 1px solid
    ${({ $isRecommended }) =>
      $isRecommended ? 'rgba(20, 20, 20, 0.35)' : 'rgba(20, 20, 20, 0.08)'};
  border-radius: 12px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  position: relative;
`;

const StyledRecommendedBadge = styled.div`
  position: absolute;
  top: 12px;
  right: 12px;
  background: #141414;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 999px;
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

  &:disabled {
    color: #141414;
    cursor: default;
    opacity: 1;
  }
`;

const StyledPriceBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 4.25rem;
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
  min-height: 1.25rem;
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

  &:hover {
    background: rgba(20, 20, 20, 0.04);
  }
`;

const StyledRoiSection = styled.div`
  text-align: center;
  margin: 0 auto 48px;
  max-width: 720px;
`;

const StyledRoiTitle = styled.h3`
  font-size: 1.35rem;
  font-weight: 600;
  margin: 0;
  color: #141414;
`;

const StyledHelpSection = styled.div`
  text-align: center;
  max-width: 640px;
  margin: 0 auto;
`;

const StyledHelpTitle = styled.h3`
  font-size: 1.15rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #141414;
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

const formatMoneyMajor = (subunits: number): string =>
  Math.round(subunits / 100).toLocaleString();

type SeatsState = Record<FreemiumPlanId, number>;

export const PricingContent = ({
  signUpUrl,
  currency,
}: PricingContentProps) => {
  const [selectedSeats, setSelectedSeats] = React.useState<SeatsState>(() =>
    buildInitialFreemiumSeatsState(),
  );

  return (
    <StyledSection>
      <StyledHeadline>{PRICING_MARKETING_HERO_HEADLINE}</StyledHeadline>
      <StyledHeadlineSub>
        {PRICING_MARKETING_HERO_SUBHEADLINE.split('\n').map(
          (line: string, index: number) => (
            <React.Fragment key={index}>
              {index > 0 ? <br /> : null}
              {line}
            </React.Fragment>
          ),
        )}
      </StyledHeadlineSub>

      <StyledCardsGrid>
        {FREEMIUM_PLAN_ORDER.map((planId) => {
          const plan = FREEMIUM_PLANS[planId];
          const seats = plan.isFree ? 1 : selectedSeats[planId];
          const perSeatSubunits = plan.pricesSubunitsPerSeat[currency];
          const totalSubunits = getFreemiumMonthlyTotalSubunits(
            planId,
            seats,
            currency,
          );
          const entitlements = getFreemiumEntitlementsForSeats(planId, seats);
          const isRecommended = planId === PRICING_RECOMMENDED_FREEMIUM_PLAN_ID;
          const currencySymbol = getPricingCurrencySymbol(currency);

          return (
            <StyledCard key={planId} $isRecommended={isRecommended}>
              {isRecommended ? (
                <StyledRecommendedBadge>
                  {PRICING_RECOMMENDED_PLAN_LABEL}
                </StyledRecommendedBadge>
              ) : null}
              <StyledCardHeader>
                <StyledCardLabel>
                  <StyledCardEmoji>{plan.icon}</StyledCardEmoji>
                  {plan.label}
                </StyledCardLabel>
                <StyledCardTitle>{plan.tagline}</StyledCardTitle>
                <StyledCardTagline>
                  Org intelligence + multi-week, multi-channel, multi-touch
                  follow up sequences
                </StyledCardTagline>
              </StyledCardHeader>

              <StyledTierSelectWrap>
                <StyledTierSelectLabel htmlFor={`seats-${planId}`}>
                  {PRICING_SEATS_LABEL}
                </StyledTierSelectLabel>
                {plan.isFree ? (
                  <StyledTierSelect
                    id={`seats-${planId}`}
                    value={1}
                    disabled
                    aria-label="1 seat included"
                  >
                    <option value={1}>1 seat</option>
                  </StyledTierSelect>
                ) : (
                  <StyledTierSelect
                    id={`seats-${planId}`}
                    value={seats}
                    onChange={(event) => {
                      const nextSeats = parseInt(event.target.value, 10);
                      setSelectedSeats((previous) => ({
                        ...previous,
                        [planId]: Number.isNaN(nextSeats)
                          ? plan.defaultSeats
                          : nextSeats,
                      }));
                    }}
                  >
                    {FREEMIUM_SEAT_OPTIONS.map((seatOption) => (
                      <option key={seatOption} value={seatOption}>
                        {seatOption} {seatOption === 1 ? 'seat' : 'seats'}
                      </option>
                    ))}
                  </StyledTierSelect>
                )}
              </StyledTierSelectWrap>

              <StyledPriceBlock>
                <StyledPrice>
                  {plan.isFree ? (
                    <>
                      {currencySymbol}0<StyledPriceUnit> / mo</StyledPriceUnit>
                    </>
                  ) : (
                    <>
                      {currencySymbol}
                      {formatMoneyMajor(perSeatSubunits)}
                      <StyledPriceUnit>
                        {' '}
                        {PRICING_PER_SEAT_MONTH_UNIT}
                      </StyledPriceUnit>
                    </>
                  )}
                </StyledPrice>
                <StyledPriceFinePrint>
                  Total: {currencySymbol}
                  {formatMoneyMajor(totalSubunits)} / mo for {seats}{' '}
                  {seats === 1 ? 'seat' : 'seats'}
                </StyledPriceFinePrint>
              </StyledPriceBlock>

              <StyledCreditsBlock>
                <StyledCreditsEquivalents>
                  Includes {entitlements.reveals.toLocaleString()} email credits
                  + {entitlements.aiCredits.toLocaleString()} AI credits / month
                </StyledCreditsEquivalents>
              </StyledCreditsBlock>

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
                  {plan.isFree
                    ? PRICING_CTA_START_FOR_FREE
                    : 'Setup a free trial'}
                </StyledCtaPrimary>
                {planId === 'enterprise' ? (
                  <StyledCtaSecondary
                    href="https://calendly.com/arxena/30min"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {PRICING_CTA_TALK_TO_SALES}
                  </StyledCtaSecondary>
                ) : (
                  <StyledCtaSecondary
                    href="https://calendly.com/arxena/30min"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {PRICING_CTA_TALK_TO_SALES}
                  </StyledCtaSecondary>
                )}
              </StyledCtaStack>
            </StyledCard>
          );
        })}
      </StyledCardsGrid>

      <StyledRoiSection>
        <StyledRoiTitle>{PRICING_MARKETING_ROI_HEADLINE}</StyledRoiTitle>
        <p style={{ margin: '16px 0 0 0', fontSize: 14, color: '#818181' }}>
          {creditPackPricingFootnote}
        </p>
      </StyledRoiSection>

      <StyledHelpSection>
        <p style={{ margin: '0 0 16px 0', fontSize: 15, color: '#474747' }}>
          {PRICING_HELP_ENGAGEMENT_LEAD}{' '}
          <StyledEngageLink href="/engage">
            {PRICING_HELP_ENGAGEMENT_LINK_LABEL}
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
