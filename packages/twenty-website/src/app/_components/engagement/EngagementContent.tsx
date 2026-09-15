'use client';

import styled from '@emotion/styled';
import { IconCheck } from '@tabler/icons-react';
import Link from 'next/link';

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

const StyledBlock = styled.div`
  margin-bottom: 48px;
`;

const StyledBlockTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: #141414;
  text-align: center;
`;

const StyledList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 560px;
  margin-left: auto;
  margin-right: auto;
`;

const StyledListItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 15px;
  color: #474747;
  line-height: 1.45;
`;

const StyledCheckIcon = styled(IconCheck)`
  flex-shrink: 0;
  color: #141414;
  margin-top: 2px;
`;

const StyledDataSources = styled.p`
  font-size: 15px;
  color: #818181;
  text-align: center;
  margin: 0 0 32px 0;
  line-height: 1.5;
`;

const StyledLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px 24px;
  margin-bottom: 48px;
`;

const StyledTextLink = styled(Link)`
  font-size: 15px;
  color: #141414;
  text-decoration: underline;
  text-underline-offset: 3px;

  &:hover {
    color: #474747;
  }
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
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
`;

const StyledSecondaryLink = styled(Link)`
  font-size: 14px;
  color: #818181;
  text-decoration: none;

  &:hover {
    color: #141414;
  }
`;

type EngagementContentProps = {
  signUpUrl: string;
};

export const EngagementContent = ({ signUpUrl }: EngagementContentProps) => {
  const { sections } = ENGAGE_PAGE;

  return (
    <StyledSection>
      <StyledHeadline>{ENGAGE_PAGE.headline}</StyledHeadline>
      <StyledHeadlineSub>{ENGAGE_PAGE.subheadline}</StyledHeadlineSub>

      <EngagementChatDemo />

      <StyledBlock>
        <StyledBlockTitle>{sections.whatYouCanDoTitle}</StyledBlockTitle>
        <StyledList>
          {sections.whatYouCanDo.map((item) => (
            <StyledListItem key={item}>
              <StyledCheckIcon size={18} strokeWidth={2.5} />
              {item}
            </StyledListItem>
          ))}
        </StyledList>
      </StyledBlock>

      <StyledBlock>
        <StyledBlockTitle>{sections.howItTiesTitle}</StyledBlockTitle>
        <StyledList>
          {sections.howItTies.map((item) => (
            <StyledListItem key={item}>
              <StyledCheckIcon size={18} strokeWidth={2.5} />
              {item}
            </StyledListItem>
          ))}
        </StyledList>
      </StyledBlock>

      <StyledDataSources>
        Built on the live org graph from LinkedIn and other sources—so every
        message references structure and context, not just a title in a list.
      </StyledDataSources>

      <StyledLinks>
        <StyledTextLink href={sections.productsLinkHref}>
          {sections.productsLinkLabel}
        </StyledTextLink>
        <StyledTextLink href={sections.salesLinkHref}>
          {sections.salesLinkLabel}
        </StyledTextLink>
        <StyledTextLink href={sections.recruitingLinkHref}>
          {sections.recruitingLinkLabel}
        </StyledTextLink>
      </StyledLinks>

      <StyledCtaSection>
        <StyledCtaButton href={signUpUrl}>Setup a free trial</StyledCtaButton>
        <StyledSecondaryLink href="/pricing">
          See Sales and Recruiting plans →
        </StyledSecondaryLink>
      </StyledCtaSection>
    </StyledSection>
  );
};
