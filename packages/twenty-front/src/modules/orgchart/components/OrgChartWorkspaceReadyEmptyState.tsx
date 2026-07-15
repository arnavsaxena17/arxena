import styled from '@emotion/styled';
import { IconHierarchy2 } from '@tabler/icons-react';
import {
    AnimatedPlaceholder,
    AnimatedPlaceholderEmptySubTitle,
    AnimatedPlaceholderEmptyTextContainer,
    AnimatedPlaceholderEmptyTitle,
} from 'twenty-ui';

import { OrgChartCompanySearchWrapper } from '@/orgchart/components/OrgChartCompanySearchWrapper';

const StyledEmptyStateOrgChartSearch = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 420px;
`;

const StyledEmptyStateOrgChartSearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledEmptyStateOrgChartCreditsBadge = styled.span`
margin-top:100px;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.tertiary};
  white-space: nowrap;
`;

const StyledOrgChartEmptyStateWrapper = styled.div`
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: ${({ theme }) => theme.spacing(8)};
  gap: ${({ theme }) => theme.spacing(6)};
  text-align: center;
`;

type OrgChartWorkspaceReadyEmptyStateProps = {
  onCompanySelect: (company: {
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
    companyDomain?: string;
  }) => void;
  hasToken: boolean;
  orgChartCredits?: number;
};

export const OrgChartWorkspaceReadyEmptyState = ({
  onCompanySelect,
  hasToken,
  orgChartCredits,
}: OrgChartWorkspaceReadyEmptyStateProps) => (
  <StyledOrgChartEmptyStateWrapper>
    <AnimatedPlaceholder type="noRecord" />
    <AnimatedPlaceholderEmptyTextContainer>
      <AnimatedPlaceholderEmptyTitle>
        Your workspace is ready
      </AnimatedPlaceholderEmptyTitle>
      <AnimatedPlaceholderEmptySubTitle>
        Search for a company to explore org charts
      </AnimatedPlaceholderEmptySubTitle>
    </AnimatedPlaceholderEmptyTextContainer>
    <StyledEmptyStateOrgChartSearch>
      {/* <StyledEmptyStateOrgChartSearchRow> */}
        <OrgChartCompanySearchWrapper
          onCompanySelect={onCompanySelect}
          placeholder="Search any company\'s org chart..."
          disabled={!hasToken}
          startIcon={<IconHierarchy2 size={20} />}
        />
        {/* {orgChartCredits !== undefined && (
          <StyledEmptyStateOrgChartCreditsBadge>
            {orgChartCredits} credits
          </StyledEmptyStateOrgChartCreditsBadge>
        )} */}
      {/* </StyledEmptyStateOrgChartSearchRow> */}
    </StyledEmptyStateOrgChartSearch>
  </StyledOrgChartEmptyStateWrapper>
);
