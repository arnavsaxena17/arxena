import { ReactNode, useState } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { OrgChartFilters, OrgChartFiltersProps } from 'twenty-orgchart';

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
  position: absolute;
  left: 50%;
  top: ${themeCssVariables.spacing[2]};
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]}
    ${themeCssVariables.spacing[1.5]};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${themeCssVariables.background.primary};
`;

const StyledMonthLabel = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
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
  margin-left: auto;
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[2]};
  flex-shrink: 0;
  padding: ${themeCssVariables.spacing[1.5]}
    ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.md};
  border: 1px solid ${themeCssVariables.border.color.light};
  background: ${themeCssVariables.background.transparent.light};
`;

const StyledBackButton = styled.button`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  margin-right: ${themeCssVariables.spacing[2]};
  cursor: pointer;
  background: transparent;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
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
