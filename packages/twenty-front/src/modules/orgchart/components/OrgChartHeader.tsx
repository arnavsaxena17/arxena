import styled from '@emotion/styled';
import { useState } from 'react';

import type { ReactNode } from 'react';
import type { OrgChartFiltersProps } from 'twenty-orgchart';
import { OrgChartFilters } from 'twenty-orgchart';
import { Button } from 'twenty-ui';

import type { OrgChartBusinessDivisionQueryProps } from './OrgChartBusinessDivisionQuery';
import { OrgChartBusinessDivisionQuery } from './OrgChartBusinessDivisionQuery';
import { OrgChartCompanyDrawer } from './OrgChartCompanyDrawer';
import type { OrgChartCompanyInfoProps } from './OrgChartCompanyInfo';
import { OrgChartCompanyInfo } from './OrgChartCompanyInfo';

const StyledHeader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;
`;

const StyledOrgChartToolbar = styled.div`
  margin-left: auto;
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  flex-shrink: 0;
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  background: ${({ theme }) => theme.background.transparent.light};
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

const StyledShareButton = styled(Button)`
  margin-left: ${({ theme }) => theme.spacing(2)};
`;

export type OrgChartHeaderProps = OrgChartCompanyInfoProps & {
  onBack?: () => void;
  hasFilters: boolean;
  filtersProps: OrgChartFiltersProps;
  businessDivisionQueryProps?: OrgChartBusinessDivisionQueryProps;
  /** Extra controls in the filter toolbar (e.g. LinkedIn query generator preference). */
  toolbarTrailing?: ReactNode;
  onClearCompanyCache?: () => void;
  onShare?: () => void;
};

export const OrgChartHeader = ({
  onBack,
  hasFilters,
  filtersProps,
  businessDivisionQueryProps,
  toolbarTrailing,
  onClearCompanyCache,
  onShare,
  ...companyInfoProps
}: OrgChartHeaderProps) => {
  const [isCompanyDrawerOpen, setIsCompanyDrawerOpen] = useState(false);

  return (
    <>
      <StyledHeader>
        {/* {onBack && (
          <StyledBackButton type="button" onClick={onBack}>
            ← Back to jobs
          </StyledBackButton>
        )} */}
        <OrgChartCompanyInfo
          {...companyInfoProps}
          onViewDetails={() => setIsCompanyDrawerOpen(true)}
        />
        {onShare && (
          <StyledShareButton
            title="Share"
            variant="secondary"
            accent="default"
            size="small"
            type="button"
            onClick={onShare}
          />
        )}
        {hasFilters && (
          <StyledOrgChartToolbar>
            <OrgChartFilters {...filtersProps} omitMarginLeft />
            {businessDivisionQueryProps && (
              <OrgChartBusinessDivisionQuery {...businessDivisionQueryProps} />
            )}

            {/* Remove the tool bar trailing which has the linkedin query generator preference. */}
            {/* {toolbarTrailing} */}
          </StyledOrgChartToolbar>
        )}
      </StyledHeader>
      <OrgChartCompanyDrawer
        {...companyInfoProps}
        isOpen={isCompanyDrawerOpen}
        onClose={() => setIsCompanyDrawerOpen(false)}
        onClearCompanyCache={onClearCompanyCache}
      />
    </>
  );
};
