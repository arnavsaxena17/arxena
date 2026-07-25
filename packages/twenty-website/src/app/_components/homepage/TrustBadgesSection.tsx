'use client';

import styled from '@emotion/styled';

import { TRUST_COMPANIES } from '@/lib/homepage-content';

const StyledSection = styled.section`
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 24px 48px;
`;

const StyledText = styled.p`
  font-size: 14px;
  color: #818181;
  margin: 0;
  text-align: center;
`;

export const TrustBadgesSection = () => {
  const companiesText = TRUST_COMPANIES.join(', ');
  return (
    <StyledSection>
      <StyledText>Trusted by teams at {companiesText}</StyledText>
    </StyledSection>
  );
};
