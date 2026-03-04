'use client';

import styled from '@emotion/styled';
import Link from 'next/link';

import { HOW_IT_WORKS_STEPS } from '@/lib/homepage-content';

const StyledSection = styled.section`
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px;
`;

const StyledTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 24px 0;
  color: #141414;
  text-align: center;
`;

const StyledStepsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;

  @media (max-width: 809px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const StyledStepCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 16px;
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
`;

const StyledStepLink = styled(Link)`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 16px;
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: #f5f5f5;
    border-color: rgba(20, 20, 20, 0.15);
  }
`;

const StyledStepNumber = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #141414;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
`;

const StyledStepTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #141414;
`;

const StyledStepDescription = styled.div`
  font-size: 14px;
  color: #818181;
  line-height: 1.5;
`;

export const HowItWorksSection = () => {
  return (
    <StyledSection>
      <StyledTitle>How it works</StyledTitle>
      <StyledStepsGrid>
        {HOW_IT_WORKS_STEPS.map((item) => {
          const content = (
            <>
              <StyledStepNumber>{item.step}</StyledStepNumber>
              <StyledStepTitle>{item.title}</StyledStepTitle>
              <StyledStepDescription>{item.description}</StyledStepDescription>
            </>
          );

          if ('href' in item && item.href) {
            return (
              <StyledStepLink key={item.step} href={item.href} prefetch={false}>
                {content}
              </StyledStepLink>
            );
          }

          return <StyledStepCard key={item.step}>{content}</StyledStepCard>;
        })}
      </StyledStepsGrid>
    </StyledSection>
  );
};
