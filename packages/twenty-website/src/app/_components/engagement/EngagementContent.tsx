'use client';

import styled from '@emotion/styled';
import { IconCheck } from '@tabler/icons-react';

import { ENGAGE_PAGE } from '@/lib/brand-content';

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

const StyledCtaSection = styled.div`
  text-align: center;
`;

const WORKFLOW_ITEMS = [
  'Personalized messages in your voice',
  'Context from the target org chart',
  'WhatsApp, LinkedIn, and email',
  'You only step in when someone replies',
  'Campaign management',
];

type EngagementContentProps = {
  signUpUrl: string;
};

export const EngagementContent = ({ signUpUrl }: EngagementContentProps) => {
  return (
    <StyledSection>
      <StyledHeadline>{ENGAGE_PAGE.headline}</StyledHeadline>
      <StyledHeadlineSub>{ENGAGE_PAGE.subheadline}</StyledHeadlineSub>

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
        Built on the live org graph from LinkedIn and other sources—so every
        message references structure and context, not just a title in a list.
      </StyledDataSources>

      <StyledCtaSection>
        <StyledCtaButton href={signUpUrl}>Setup a free trial</StyledCtaButton>
      </StyledCtaSection>
    </StyledSection>
  );
};
