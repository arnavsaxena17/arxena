import styled from '@emotion/styled';
import { ReactNode, useState } from 'react';

import { OrgChartFilters, OrgChartFiltersProps } from 'twenty-orgchart';
import { Button } from 'twenty-ui';

import {
    OrgChartBusinessDivisionQuery,
    OrgChartBusinessDivisionQueryProps,
} from './OrgChartBusinessDivisionQuery';
import { OrgChartCompanyDrawer } from './OrgChartCompanyDrawer';
import {
    OrgChartCompanyInfo,
    OrgChartCompanyInfoProps,
} from './OrgChartCompanyInfo';

const StyledHeader = styled.div`
  align-items: flex-start;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  container-name: orgchart-header;
  container-type: inline-size;
  display: flex;
  flex-shrink: 0;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  position: relative;
`;

const StyledMonthPickerCenter = styled.div`
  position: absolute;
  left: 50%;
  top: ${({ theme }) => theme.spacing(2)};
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)}
    ${({ theme }) => theme.spacing(1.5)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.primary};
`;

const StyledMonthLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  white-space: nowrap;
`;

const StyledMonthInput = styled.input`
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: ${({ theme }) => theme.spacing(0.5)}
    ${({ theme }) => theme.spacing(1)};
`;

const StyledOrgChartToolbar = styled.div`
  margin-left: auto;
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  flex-shrink: 0;
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)};
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
  /** URL-backed MonthYear snapshot (YYYY-MM). */
  asOfMonth?: string;
  onAsOfMonthChange?: (next: string) => void;
  /** Optional timeline metrics payload (shown in drawer). */
  timelineMetrics?: Record<string, unknown> | null;
  timelineProfilesOptions?: {
    baseUrl: string;
    accessToken?: string;
    companyId: string;
    asOfMonth?: string;
    companyName?: string;
    sampleSource?: string;
    sampleProfiles?: string;
    includeOrgIntelligence?: string;
  };
};

export const OrgChartHeader = ({
  onBack,
  hasFilters,
  filtersProps,
  businessDivisionQueryProps,
  toolbarTrailing,
  onClearCompanyCache,
  onShare,
  asOfMonth,
  onAsOfMonthChange,
  timelineMetrics,
  timelineProfilesOptions,
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
        {/* {onAsOfMonthChange && (
          <StyledMonthPickerCenter>
            <StyledMonthLabel>As of</StyledMonthLabel>
            <StyledMonthInput
              type="month"
              value={asOfMonth ?? ''}
              onChange={(e) => onAsOfMonthChange(e.target.value)}
            />
          </StyledMonthPickerCenter>
        )} */}
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
        timelineMetrics={timelineMetrics ?? null}
        timelineProfilesOptions={timelineProfilesOptions}
        isOpen={isCompanyDrawerOpen}
        onClose={() => setIsCompanyDrawerOpen(false)}
        onClearCompanyCache={onClearCompanyCache}
      />
    </>
  );
};
