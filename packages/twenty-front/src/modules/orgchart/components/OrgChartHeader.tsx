import { type ReactNode, useState } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OrgChartFilters, type OrgChartFiltersProps } from 'twenty-orgchart';

import {
    OrgChartBusinessDivisionQuery,
    type OrgChartBusinessDivisionQueryProps,
} from './OrgChartBusinessDivisionQuery';
import { OrgChartCompanyDrawer } from './OrgChartCompanyDrawer';
import {
    OrgChartCompanyInfo,
    type OrgChartCompanyInfoProps,
} from './OrgChartCompanyInfo';
import {
    OrgChartTitleQueryBar,
    type OrgChartTitleQueryBarProps,
} from './OrgChartTitleQueryBar';

const StyledHeader = styled.div`
  align-items: flex-start;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  container-name: orgchart-header;
  container-type: inline-size;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
  position: relative;
`;

const StyledMonthPickerCenter = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  left: 50%;
  padding: ${themeCssVariables.spacing[1]}
    ${themeCssVariables.spacing[1.5]};
  position: absolute;
  top: ${themeCssVariables.spacing[2]};
  transform: translateX(-50%);
`;

const StyledMonthLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  white-space: nowrap;
`;

const StyledMonthInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[0.5]}
    ${themeCssVariables.spacing[1]};
`;

const StyledOrgChartToolbar = styled.div`
  align-items: flex-end;
  background: ${themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex: 1 1 auto;
  flex-wrap: nowrap;
  gap: ${themeCssVariables.spacing[2]};
  margin-left: auto;
  min-width: 0;
  padding: ${themeCssVariables.spacing[1.5]}
    ${themeCssVariables.spacing[2]};

  @container orgchart-header (max-width: 720px) {
    flex-wrap: wrap;
  }
`;

const StyledBackButton = styled.button`
  background: transparent;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  margin-right: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

export type OrgChartHeaderProps = OrgChartCompanyInfoProps & {
  onBack?: () => void;
  hasFilters: boolean;
  filtersProps: OrgChartFiltersProps;
  businessDivisionQueryProps?: OrgChartBusinessDivisionQueryProps;
  titleQueryProps?: OrgChartTitleQueryBarProps;
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
  titleQueryProps,
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
          onShare={onShare}
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
        {hasFilters && (
          <StyledOrgChartToolbar>
            <OrgChartFilters {...filtersProps} omitMarginLeft />
            {titleQueryProps && (
              <OrgChartTitleQueryBar {...titleQueryProps} />
            )}
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
