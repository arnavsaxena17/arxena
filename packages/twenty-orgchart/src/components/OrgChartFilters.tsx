import styled from '@emotion/styled';
import { IconSearch } from '@tabler/icons-react';

import { toTitleCase } from 'twenty-shared';

import type { OrgChartDiagramHandle } from './OrgChartDiagram.types';

const StyledFiltersContainer = styled.div<{ $omitMarginLeft?: boolean }>`
  margin-left: ${({ $omitMarginLeft }) => ($omitMarginLeft ? '0' : 'auto')};
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  max-width: 100%;
`;

const StyledFilterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
  min-width: 0;
`;

const StyledFilterLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const StyledSelect = styled.select`
  min-width: 120px;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ${({ theme }) => theme.font.family};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledSearchContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  flex-wrap: nowrap;
  justify-content: flex-end;
  max-width: 100%;
`;

const StyledSearchInputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 200px;
  min-width: 0;
  max-width: 280px;
`;

const StyledSearchInput = styled.input`
  width: 100%;
  min-width: 0;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  padding-left: ${({ theme }) => theme.spacing(4)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ${({ theme }) => theme.font.family};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledSearchIcon = styled(IconSearch)`
  position: absolute;
  left: ${({ theme }) => theme.spacing(0)};
  width: 16px;
  height: 16px;
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledSearchButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(1.5)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;

  &:hover:enabled {
    background: ${({ theme }) => theme.background.transparent.light};
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;

const StyledSearchMeta = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  min-width: 72px;
  text-align: right;
  white-space: nowrap;
`;

const StyledSearchNavGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  white-space: nowrap;
  justify-content: flex-start;
`;

export type OrgChartFiltersProps = {
  availableCountries: string[];
  countryPercentLabels: Record<string, string>;
  selectedCountry: string | undefined;
  onCountryChange: (country: string | undefined) => void;
  availableFunctionRoots: string[];
  functionRootPercentLabels: Record<string, string>;
  selectedFunctionRoot: string | undefined;
  onFunctionRootChange: (fn: string | undefined) => void;
  /** When true, do not push filters to the far right (parent handles layout). */
  omitMarginLeft?: boolean;
};

export type OrgChartSearchControlsProps = {
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  searchResultCount: number | null;
  onSearch: () => void;
  onClearSearch: () => void;
  diagramHandleRef: React.RefObject<OrgChartDiagramHandle | null>;
  onGetAll: () => void;
  onGetLeaders: () => void;
  onViewAllCandidates: () => void;
};

export const OrgChartFilters = ({
  availableCountries,
  countryPercentLabels,
  selectedCountry,
  onCountryChange,
  availableFunctionRoots,
  functionRootPercentLabels,
  selectedFunctionRoot,
  onFunctionRootChange,
  omitMarginLeft,
}: OrgChartFiltersProps) => {
  const visibleFunctionRoots = availableFunctionRoots.filter(
    (fn) => !fn.toLowerCase().includes('assist'),
  );

  return (
    <StyledFiltersContainer $omitMarginLeft={omitMarginLeft}>
      {availableCountries.length > 0 && (
        <StyledFilterGroup>
          <StyledFilterLabel>Country</StyledFilterLabel>
          <StyledSelect
            value={selectedCountry ?? ''}
            onChange={(event) =>
              onCountryChange(
                event.target.value ? event.target.value : undefined,
              )
            }
          >
            {availableCountries.map((country) => (
              <option key={country} value={country}>
                {countryPercentLabels[country]
                  ? `${toTitleCase(country)} (${countryPercentLabels[country]})`
                  : toTitleCase(country)}
              </option>
            ))}
          </StyledSelect>
        </StyledFilterGroup>
      )}
      {visibleFunctionRoots.length > 0 && (
        <StyledFilterGroup>
          <StyledFilterLabel>Function</StyledFilterLabel>
          <StyledSelect
            value={selectedFunctionRoot ?? ''}
            onChange={(event) =>
              onFunctionRootChange(
                event.target.value ? event.target.value : undefined,
              )
            }
          >
            {visibleFunctionRoots.map((fn) => (
              <option key={fn} value={fn}>
                {functionRootPercentLabels[fn]
                  ? `${toTitleCase(fn)} (${functionRootPercentLabels[fn]})`
                  : toTitleCase(fn)}
              </option>
            ))}
          </StyledSelect>
        </StyledFilterGroup>
      )}
    </StyledFiltersContainer>
  );
};

export const OrgChartSearchControls = ({
  searchTerm,
  onSearchTermChange,
  searchResultCount,
  onSearch,
  onClearSearch,
  diagramHandleRef,
}: OrgChartSearchControlsProps) => {
  return (
    <StyledSearchContainer>
      <StyledSearchInputWrapper>
        <StyledSearchIcon />
        <StyledSearchInput
          placeholder="Search org chart"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearch();
          }}
        />
      </StyledSearchInputWrapper>
      <StyledSearchButton type="button" onClick={onSearch}>
        Search
      </StyledSearchButton>
      <StyledSearchNavGroup>
        <StyledSearchButton
          type="button"
          disabled={!searchResultCount}
          onClick={() => diagramHandleRef.current?.focusPreviousResult()}
        >
          Prev
        </StyledSearchButton>
        <StyledSearchButton
          type="button"
          disabled={!searchResultCount}
          onClick={() => diagramHandleRef.current?.focusNextResult()}
        >
          Next
        </StyledSearchButton>
        <StyledSearchButton
          type="button"
          disabled={!searchResultCount}
          onClick={onClearSearch}
        >
          Clear
        </StyledSearchButton>
        <StyledSearchMeta>
          {typeof searchResultCount === 'number' && searchResultCount > 0
            ? `${searchResultCount} result${searchResultCount === 1 ? '' : 's'}`
            : ''}
        </StyledSearchMeta>
      </StyledSearchNavGroup>
    </StyledSearchContainer>
  );
};
