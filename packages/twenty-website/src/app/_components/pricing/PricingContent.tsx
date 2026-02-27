'use client';

import styled from '@emotion/styled';
import { IconCheck } from '@tabler/icons-react';
import Link from 'next/link';

const StyledSection = styled.section`
  max-width: 900px;
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
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
  margin-bottom: 48px;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
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

const PRICING_TIERS = [
  {
    name: '1 org chart',
    price: 799,
    credits: '1 credit (<100 employees)',
    useCase: 'One-off mapping',
    features: [
      'Full org chart structure',
      'LinkedIn profiles + emails',
      'Sign up to unmask names',
    ],
  },
  {
    name: '5 org charts',
    price: 2499,
    credits: '5 credits (~$500/credit)',
    useCase: 'Individual recruiters',
    features: ['5 org charts', 'All features included', '12-month expiry'],
  },
  {
    name: '15 org charts',
    price: 4999,
    credits: '15 credits (~$333/credit)',
    useCase: 'TA teams, agencies',
    features: ['15 org charts', 'All features included', '12-month expiry'],
  },
  {
    name: '30 org charts',
    price: 7999,
    credits: '30 credits (~$267/credit)',
    useCase: 'Power users, bulk mandates',
    features: ['30 org charts', 'All features included', '12-month expiry'],
  },
];

export const PricingContent = ({ signUpUrl }: PricingContentProps) => {
  return (
    <StyledSection>
      <StyledHeadline>Map any company&apos;s org chart</StyledHeadline>
      <StyledHeadlineSub>
        A fraction of one recruitment fee. Recruiters pay $5K–40K per placement
        with no mapping — org charts from $799.
      </StyledHeadlineSub>

      <StyledCardsGrid>
        {PRICING_TIERS.map(({ name, price, credits, features }) => (
          <StyledCard key={name}>
            <StyledCardTitle>{name}</StyledCardTitle>
            <StyledPrice>${price.toLocaleString()}</StyledPrice>
            <StyledCredits>{credits}</StyledCredits>
            <StyledFeatureList>
              {features.map((feature) => (
                <StyledFeatureItem key={feature}>
                  <StyledCheckIcon size={20} strokeWidth={2.5} />
                  {feature}
                </StyledFeatureItem>
              ))}
            </StyledFeatureList>
            <StyledCtaButton href={signUpUrl}>Start free</StyledCtaButton>
          </StyledCard>
        ))}
      </StyledCardsGrid>

      <StyledRoiSection>
        <StyledRoiTitle>
          One placement costs $5K–40K. Map the entire org for less.
        </StyledRoiTitle>
        <StyledRoiText>
          Recruiters charge $5K–40K per placement — and don&apos;t provide
          mapping. ZoomInfo costs $25K+. We give you the full org chart for a
          fraction of one hire.
        </StyledRoiText>
        <p style={{ margin: '16px 0 0 0', fontSize: 14, color: '#818181' }}>
          1 credit = 1 org chart (&lt;100 employees). Larger org charts consume
          more (e.g. 300 employees = 3 credits).
        </p>
        <p style={{ margin: '12px 0 0 0', fontSize: 14, color: '#818181' }}>
          Credit card payments: +3% surcharge. Pay by invoice: no surcharge.
          (Invoice option available after sign-up.)
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
