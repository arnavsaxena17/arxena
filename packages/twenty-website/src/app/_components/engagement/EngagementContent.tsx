'use client';

import styled from '@emotion/styled';
import { IconCheck } from '@tabler/icons-react';

import { EngagementChatDemo } from './EngagementChatDemo';

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
  line-height: 1.5;
`;

const StyledWorkflowSection = styled.div`
  margin-bottom: 48px;
`;

const StyledWorkflowTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #141414;
  text-align: center;
`;

const StyledWorkflowList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px 24px;
`;

const StyledWorkflowItem = styled.li`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  color: #474747;
`;

const StyledCheckIcon = styled(IconCheck)`
  flex-shrink: 0;
  color: #141414;
`;

const StyledDataSources = styled.p`
  font-size: 15px;
  color: #818181;
  text-align: center;
  margin: 0 0 48px 0;
`;

const StyledCardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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

const StyledPriceUnit = styled.span`
  font-size: 16px;
  font-weight: 400;
  color: #818181;
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

const StyledFooterLine = styled.p`
  font-size: 15px;
  color: #818181;
  text-align: center;
  margin: 0 0 48px 0;
`;

const StyledCtaSection = styled.div`
  text-align: center;
`;

const ENGAGEMENT_TIERS = [
  {
    name: 'Starter',
    price: 499,
    features: [
      '3 active campaigns',
      '500 outreach / month',
      'AI filter + enrich',
    ],
  },
  {
    name: 'Growth',
    price: 999,
    features: [
      '10 active campaigns',
      '2,000 outreach / month',
      'AI filter + enrich',
      'Phone + WhatsApp',
    ],
  },
  {
    name: 'Scale',
    price: 2499,
    features: [
      '30 active campaigns',
      '10,000 outreach / month',
      'AI filter + enrich',
      'Phone + WhatsApp',
      'API access',
    ],
  },
];

const WORKFLOW_ITEMS = [
  'AI filters candidates by fit',
  'Outreach across LinkedIn, WhatsApp, email',
  'Phone/email enrichment',
  '"Interested" detection',
  'Campaign management',
];

type EngagementContentProps = {
  signUpUrl: string;
};

export const EngagementContent = ({ signUpUrl }: EngagementContentProps) => {
  return (
    <StyledSection>
      <StyledHeadline>
        You&apos;ve identified the right people. Now what?
      </StyledHeadline>
      <StyledHeadlineSub>
        Our AI reaches out from your own WhatsApp and LinkedIn accounts.
        Messages go from you — human-like — across any channel. You only talk to
        people who are interested.
      </StyledHeadlineSub>

      <EngagementChatDemo />

      <StyledWorkflowSection>
        <StyledWorkflowTitle>How it works</StyledWorkflowTitle>
        <StyledWorkflowList>
          {WORKFLOW_ITEMS.map((item) => (
            <StyledWorkflowItem key={item}>
              <StyledCheckIcon size={18} strokeWidth={2.5} />
              {item}
            </StyledWorkflowItem>
          ))}
        </StyledWorkflowList>
      </StyledWorkflowSection>

      <StyledDataSources>
        Data sources: LinkedIn, Naukri, Indeed, Glassdoor, and more.
      </StyledDataSources>

      <StyledCardsGrid>
        {ENGAGEMENT_TIERS.map(({ name, price, features }) => (
          <StyledCard key={name}>
            <StyledCardTitle>{name}</StyledCardTitle>
            <StyledPrice>
              ${price.toLocaleString()}
              <StyledPriceUnit>/mo</StyledPriceUnit>
            </StyledPrice>
            <StyledFeatureList>
              {features.map((feature) => (
                <StyledFeatureItem key={feature}>
                  <StyledCheckIcon size={20} strokeWidth={2.5} />
                  {feature}
                </StyledFeatureItem>
              ))}
            </StyledFeatureList>
            <StyledCtaButton href={signUpUrl}>Start engaging</StyledCtaButton>
          </StyledCard>
        ))}
      </StyledCardsGrid>

      <StyledFooterLine>
        Includes org charts for all campaign targets. No double-paying.
      </StyledFooterLine>

      <StyledCtaSection>
        <StyledCtaButton href={signUpUrl}>Start engaging</StyledCtaButton>
      </StyledCtaSection>
    </StyledSection>
  );
};
