'use client';

import styled from '@emotion/styled';
import { Theme } from '@/app/_components/ui/theme/theme';

const StyledSection = styled.section`
  padding: ${Theme.spacing(12)} ${Theme.spacing(6)};
  background: ${Theme.color.gray10};
  @media (max-width: 809px) {
    padding: ${Theme.spacing(8)} ${Theme.spacing(4)};
  }
`;

const StyledTitle = styled.h2`
  font-size: ${Theme.font.size.xl};
  font-weight: ${Theme.font.weight.medium};
  color: ${Theme.text.color.primary};
  text-align: center;
  margin: 0 0 ${Theme.spacing(8)};
`;

const StyledQuotesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: ${Theme.spacing(6)};
  max-width: 1000px;
  margin: 0 auto;
`;

const StyledQuoteCard = styled.blockquote`
  margin: 0;
  padding: ${Theme.spacing(4)};
  background: ${Theme.color.white};
  border-radius: ${Theme.border.radius.md};
  border: 1px solid ${Theme.color.gray20};
  font-size: ${Theme.font.size.base};
  color: ${Theme.text.color.secondary};
  line-height: ${Theme.text.lineHeight.lg};
`;

const StyledAttribution = styled.cite`
  display: block;
  margin-top: ${Theme.spacing(2)};
  font-size: ${Theme.font.size.sm};
  color: ${Theme.text.color.tertiary};
  font-style: normal;
`;

export function LandingSocialProof() {
  return (
    <StyledSection>
      <StyledTitle>Trusted by founders building the next unicorn</StyledTitle>
      <StyledQuotesGrid>
        <StyledQuoteCard>
          "I saw exactly how [competitor] structured their product team before
          our Series A. Worth 10x the $5,000."
          <StyledAttribution>— Founder, UK Fintech Startup</StyledAttribution>
        </StyledQuoteCard>
        <StyledQuoteCard>
          "ZoomInfo showed me 8 executives. Arxena showed me 200 employees
          across every department."
          <StyledAttribution>
            — Executive Search Partner, Singapore
          </StyledAttribution>
        </StyledQuoteCard>
      </StyledQuotesGrid>
    </StyledSection>
  );
}
