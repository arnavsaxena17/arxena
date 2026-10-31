import styled from '@emotion/styled';

import {
    ORG_CHART_COMPANY_AUTOCOMPLETE_SOURCE_LABELS,
    ORG_CHART_COMPANY_AUTOCOMPLETE_SOURCES,
    type OrgChartCompanyAutocompleteSource,
} from '../types/orgChartCompanyAutocompleteSource';

const StyledSelect = styled.select<{ $dense?: boolean }>`
  padding: ${({ theme, $dense }) =>
    $dense
      ? `${theme.spacing(0.75)} ${theme.spacing(1.5)}`
      : `${theme.spacing(1)} ${theme.spacing(2)}`};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme, $dense }) =>
    $dense ? theme.font.size.xs : theme.font.size.sm};
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
        const next = event.target
          .value as OrgChartCompanyAutocompleteSource;
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
