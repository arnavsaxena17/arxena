'use client';

import styled from '@emotion/styled';
import { Theme } from '@/app/_components/ui/theme/theme';

const StyledSection = styled.section`
  padding: ${Theme.spacing(12)} ${Theme.spacing(6)};
  @media (max-width: 809px) {
    padding: ${Theme.spacing(8)} ${Theme.spacing(4)};
  }
`;

const StyledTitle = styled.h2`
  font-size: ${Theme.font.size.xl};
  font-weight: ${Theme.font.weight.medium};
  color: ${Theme.text.color.primary};
  text-align: center;
  margin: 0 0 ${Theme.spacing(10)};
`;

const StyledColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${Theme.spacing(8)};
  max-width: 1000px;
  margin: 0 auto;
  @media (max-width: 809px) {
    grid-template-columns: 1fr;
    gap: ${Theme.spacing(6)};
  }
`;

const StyledColumn = styled.div`
  padding: ${Theme.spacing(4)};
  text-align: center;
`;

const StyledColumnTitle = styled.h3`
  font-size: ${Theme.font.size.lg};
  font-weight: ${Theme.font.weight.medium};
  color: ${Theme.text.color.primary};
  margin: 0 0 ${Theme.spacing(2)};
`;

const StyledColumnBody = styled.p`
  font-size: ${Theme.font.size.base};
  color: ${Theme.text.color.secondary};
  line-height: ${Theme.text.lineHeight.lg};
  margin: 0;
`;

export function LandingHowItsDifferent() {
  return (
    <StyledSection>
      <StyledTitle>Not another contact database</StyledTitle>
      <StyledColumns>
        <StyledColumn>
          <StyledColumnTitle>Full-company depth</StyledColumnTitle>
          <StyledColumnBody>
            ZoomInfo shows leadership. We map thousands of employees.
          </StyledColumnBody>
        </StyledColumn>
        <StyledColumn>
          <StyledColumnTitle>Built for recruiting</StyledColumnTitle>
          <StyledColumnBody>
            Sales teams buy org charts for account mapping. You need talent
            intelligence.
          </StyledColumnBody>
        </StyledColumn>
        <StyledColumn>
          <StyledColumnTitle>10x less expensive</StyledColumnTitle>
          <StyledColumnBody>
            $5,000 for 30 org charts vs. $15K+/year for limited access.
          </StyledColumnBody>
        </StyledColumn>
      </StyledColumns>
    </StyledSection>
  );
}
