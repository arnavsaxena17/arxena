'use client';

import styled from '@emotion/styled';
import { IconChartDots, IconMessageCircle } from '@tabler/icons-react';
import Link from 'next/link';

import { DIFFERENTIATORS } from '@/lib/homepage-content';

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

const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const StyledCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 24px;
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
`;

const StyledCardLink = styled(Link)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 24px;
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

const StyledIconWrapper = styled.div`
  width: 40px;
  height: 40px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledCardTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #141414;
`;

const StyledCardDescription = styled.div`
  font-size: 14px;
  color: #818181;
  line-height: 1.5;
`;

const DIFFERENTIATOR_ICONS = [IconChartDots, IconMessageCircle];

export const DifferentiatorsSection = () => {
  return (
    <StyledSection>
      <StyledTitle>What makes Arxena different</StyledTitle>
      <StyledGrid>
        {DIFFERENTIATORS.map((item, i) => {
          const Icon = DIFFERENTIATOR_ICONS[i];
          const content = (
            <>
              <StyledIconWrapper>
                <Icon size={24} stroke={1.5} />
              </StyledIconWrapper>
              <StyledCardTitle>{item.title}</StyledCardTitle>
              <StyledCardDescription>{item.description}</StyledCardDescription>
            </>
          );

          if ('href' in item && item.href) {
            return (
              <StyledCardLink key={item.title} href={item.href} prefetch={false}>
                {content}
              </StyledCardLink>
            );
          }

          return <StyledCard key={item.title}>{content}</StyledCard>;
        })}
      </StyledGrid>
    </StyledSection>
  );
};
