import styled from '@emotion/styled';

import type { OrgChartCompanyInfoProps } from './OrgChartCompanyInfo';
import { OrgChartCompanyInfo } from './OrgChartCompanyInfo';
import type { OrgChartFiltersProps } from './OrgChartFilters';
import { OrgChartFilters } from './OrgChartFilters';

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;
`;

const StyledBackButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  margin-right: ${({ theme }) => theme.spacing(2)};
  cursor: pointer;
  background: transparent;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

export type OrgChartHeaderProps = OrgChartCompanyInfoProps & {
  onBack?: () => void;
  hasFilters: boolean;
  filtersProps: OrgChartFiltersProps;
};

export const OrgChartHeader = ({
  onBack,
  hasFilters,
  filtersProps,
  ...companyInfoProps
}: OrgChartHeaderProps) => (
  <StyledHeader>
    {onBack && (
      <StyledBackButton type="button" onClick={onBack}>
        ← Back to jobs
      </StyledBackButton>
    )}
    <OrgChartCompanyInfo {...companyInfoProps} />
    {hasFilters && <OrgChartFilters {...filtersProps} />}
  </StyledHeader>
);
