import { IconHierarchy2 } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { AnimatedPlaceholder, AnimatedPlaceholderEmptySubTitle, AnimatedPlaceholderEmptyTextContainer, AnimatedPlaceholderEmptyTitle } from 'twenty-ui';

import { OrgChartCompanySearchWrapper } from '@/orgchart/components/OrgChartCompanySearchWrapper';

const StyledEmptyStateOrgChartSearch = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  max-width: 420px;
  width: 100%;
`;

const StyledEmptyStateOrgChartSearchRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledEmptyStateOrgChartCreditsBadge = styled.span`
color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin-top:100px;
  white-space: nowrap;
`;

const StyledOrgChartEmptyStateWrapper = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[6]};
  justify-content: flex-start;
  min-height: 100%;
  padding-top: ${themeCssVariables.spacing[8]};
  text-align: center;
  width: 100%;
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
          placeholder="Search any company's org chart..."
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
