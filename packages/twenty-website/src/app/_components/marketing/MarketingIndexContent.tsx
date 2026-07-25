'use client';

import styled from '@emotion/styled';
import Link from 'next/link';

import { MarketingDetailPage } from '@/lib/marketing-site-pages';

const StyledSection = styled.section`
  max-width: 960px;
  margin: 0 auto;
  padding: 48px 24px 96px;
`;

const StyledHeadline = styled.h1`
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 600;
  line-height: 1.15;
  margin: 0 0 16px 0;
  color: #141414;
  text-align: center;
`;

const StyledSub = styled.p`
  font-size: 18px;
  line-height: 1.6;
  color: #818181;
  margin: 0 auto 48px;
  max-width: 640px;
  text-align: center;
`;

const StyledGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
`;

const StyledCard = styled(Link)`
  display: flex;
  flex-direction: column;
  padding: 24px;
  border-radius: 12px;
  border: 1px solid rgba(20, 20, 20, 0.08);
  background: #fafafa;
  text-decoration: none;
  color: inherit;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;

  &:hover {
    border-color: rgba(20, 20, 20, 0.2);
    background: #fff;
  }
`;

const StyledCardTitle = styled.div`
  font-size: 18px;
  font-weight: 600;
  color: #141414;
  margin-bottom: 8px;
`;

const StyledCardDesc = styled.div`
  font-size: 15px;
  line-height: 1.5;
  color: #818181;
`;

type MarketingIndexContentProps = {
  title: string;
  sub: string;
  items: MarketingDetailPage[];
  basePath: string;
};

export const MarketingIndexContent = ({
  title,
  sub,
  items,
  basePath,
}: MarketingIndexContentProps) => {
  return (
    <StyledSection>
      <StyledHeadline>{title}</StyledHeadline>
      <StyledSub>{sub}</StyledSub>
      <StyledGrid>
        {items.map((item) => (
          <StyledCard key={item.slug} href={`${basePath}/${item.slug}`}>
            <StyledCardTitle>{item.title}</StyledCardTitle>
            <StyledCardDesc>{item.headline}</StyledCardDesc>
          </StyledCard>
        ))}
      </StyledGrid>
    </StyledSection>
  );
};
