import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import {
  ORG_CHART_COMPANY_AUTOCOMPLETE_SOURCE_LABELS,
  ORG_CHART_COMPANY_AUTOCOMPLETE_SOURCES,
  type OrgChartCompanyAutocompleteSource,
} from '../types/orgChartCompanyAutocompleteSource';

const StyledSelect = styled.select<{ $dense?: boolean }>`
  padding: ${({ $dense }) =>
    $dense
      ? `calc(${themeCssVariables.spacing['1']} - ${themeCssVariables.spacing['0.5']} / 2) ${themeCssVariables.spacing['1.5']}`
      : `${themeCssVariables.spacing['1']} ${themeCssVariables.spacing['2']}`};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${({ $dense }) =>
    $dense ? themeCssVariables.font.size.xs : themeCssVariables.font.size.sm};
  max-width: 220px;
`;

export type OrgChartCompanyAutocompleteSourceSelectProps = {
  value: OrgChartCompanyAutocompleteSource;
  onChange: (source: OrgChartCompanyAutocompleteSource) => void;
  dense?: boolean;
  disabled?: boolean;
};

export const OrgChartCompanyAutocompleteSourceSelect = ({
  value,
  onChange,
  dense = false,
  disabled = false,
}: OrgChartCompanyAutocompleteSourceSelectProps) => {
  return (
    <StyledSelect
      $dense={dense}
      disabled={disabled}
      value={value}
      onChange={(event) => {
        const next = event.target.value as OrgChartCompanyAutocompleteSource;
        onChange(next);
      }}
      aria-label="Company search API"
    >
      {ORG_CHART_COMPANY_AUTOCOMPLETE_SOURCES.map((source) => (
        <option key={source} value={source}>
          {ORG_CHART_COMPANY_AUTOCOMPLETE_SOURCE_LABELS[source]}
        </option>
      ))}
    </StyledSelect>
  );
};
