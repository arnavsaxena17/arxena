'use client';

import styled from '@emotion/styled';
import {
  IconBriefcase,
  IconChartTreemap,
  IconRocket,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';

import { USE_CASES, USE_CASES_SECTION_SUBTITLE } from '@/lib/homepage-content';

const StyledSection = styled.section`
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 48px 24px;
`;

const StyledTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #141414;
  text-align: center;
`;

const StyledSubtitle = styled.p`
  font-size: 15px;
  color: #818181;
  margin: 0 auto 24px;
  text-align: center;
  line-height: 1.5;
  max-width: 520px;
`;

const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;

  @media (max-width: 809px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const StyledCard = styled(Link)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 24px;
  background: #fafafa;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 12px;
  text-decoration: none;
  color: #141414;
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
`;

const StyledCardDescription = styled.div`
  font-size: 14px;
  color: #818181;
  line-height: 1.5;
`;

const USE_CASE_ICONS = [IconBriefcase, IconRocket, IconChartTreemap, IconUsers];

export const UseCasesSection = () => {
  return (
    <StyledSection>
      <StyledTitle>Built for</StyledTitle>
      <StyledSubtitle>{USE_CASES_SECTION_SUBTITLE}</StyledSubtitle>
      <StyledGrid>
        {USE_CASES.map((item, i) => {
          const Icon = USE_CASE_ICONS[i];
          return (
            <StyledCard key={item.title} href={item.href} prefetch={false}>
              <StyledIconWrapper>
                <Icon size={24} stroke={1.5} />
              </StyledIconWrapper>
              <StyledCardTitle>{item.title}</StyledCardTitle>
              <StyledCardDescription>{item.description}</StyledCardDescription>
            </StyledCard>
          );
        })}
      </StyledGrid>
    </StyledSection>
  );
};
