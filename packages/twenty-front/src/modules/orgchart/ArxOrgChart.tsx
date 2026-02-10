import styled from '@emotion/styled';
import { IconBrandLinkedin, IconSearch, IconWorld } from '@tabler/icons-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  OrgChartDiagram,
  type OrgChartDiagramHandle,
} from './components/OrgChartDiagram';
import { useOrgChartData } from './hooks/useOrgChartData';
import {
  extractOrgData,
  processOrgChartToNodeData,
} from './utils/orgChartDataUtils';

export type ArxOrgChartProps = {
  companyId: string;
  companyName?: string;
  website?: string;
  locationName?: string;
  industry?: string;
  profileCount?: number;
  linkedinUrl?: string;
  onBack?: () => void;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 400px;
  background: ${({ theme }) => theme.background.primary};
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(4)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;
`;

const StyledCompanyInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.5)};
  min-width: 0;
`;

const StyledCompanyTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1.5)};
  min-width: 0;
`;

const StyledCompanyTitle = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;

const StyledCompanyMetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
`;

const StyledMetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};

  &:not(:last-child)::after {
    content: '·';
    margin-left: ${({ theme }) => theme.spacing(1)};
  }
`;

const StyledFiltersContainer = styled.div`
  margin-left: auto;
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
`;

const StyledFilterLabel = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
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

const StyledLinkIcon = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  color: ${({ theme }) => theme.font.color.primary};
  background: ${({ theme }) => theme.background.primary};
  cursor: pointer;
  text-decoration: none;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }

  svg {
    width: 14px;
    height: 14px;
  }
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

const StyledSearchContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 480px;
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
`;

const StyledDiagramArea = styled.div`
  flex: 1;
  position: relative;
  min-height: 300px;
  background: ${({ theme }) => theme.background.secondary};
`;

const StyledLoadingMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledErrorMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const ArxOrgChart = ({
  companyId,
  companyName,
  website,
  locationName,
  industry,
  profileCount,
  linkedinUrl,
  onBack,
}: ArxOrgChartProps) => {
  const [selectedCountry, setSelectedCountry] = useState<string | undefined>();
  const [selectedFunctionRoot, setSelectedFunctionRoot] = useState<
    string | undefined
  >();
  const [selectedYear, setSelectedYear] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResultCount, setSearchResultCount] = useState<number | null>(null);

  const diagramHandleRef = useRef<OrgChartDiagramHandle | null>(null);

  const { data, isLoading, error, fetchOrgChart } = useOrgChartData({
    companyId,
    companyName,
    website,
    country: selectedCountry,
    functionRoot: selectedFunctionRoot,
  });

  useEffect(() => {
    fetchOrgChart();
  }, [fetchOrgChart]);

  const orgData = useMemo(
    () => extractOrgData(data as Record<string, unknown> | null),
    [data],
  );

  useEffect(() => {
    if (!orgData || !companyId) {
      return;
    }

    setSelectedCountry((current) => {
      if (current) {
        return current;
      }
      const initialCountry =
        typeof orgData.country === 'string' ? orgData.country : undefined;
      return initialCountry;
    });

    setSelectedFunctionRoot((current) => {
      if (current) {
        return current;
      }
      const initialFunctionRoot =
        typeof (orgData as Record<string, unknown>).type === 'string'
          ? ((orgData as Record<string, unknown>).type as string)
          : undefined;
      return initialFunctionRoot;
    });

    if (!selectedYear) {
      const currentYear = new Date().getFullYear().toString();
      setSelectedYear(currentYear);
    }
  }, [orgData, companyId, selectedYear]);

  const nodeDataArray = useMemo(() => {
    if (!orgData) return [];
    return processOrgChartToNodeData(orgData);
  }, [orgData]);

  const availableCountries = useMemo(() => {
    if (!orgData) {
      return [];
    }

    const rawCountries = (orgData as Record<string, unknown>).countries;

    if (typeof rawCountries === 'string') {
      try {
        const parsed = JSON.parse(rawCountries) as unknown;
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .filter((c): c is string => typeof c === 'string')
            .filter((c) => c !== '0');

          const withGlobal = [...cleaned, 'global'];

          return Array.from(new Set(withGlobal)).sort((a, b) =>
            a.localeCompare(b),
          );
        }
      } catch {
        return [];
      }
    }

    if (Array.isArray(rawCountries)) {
      const cleaned = rawCountries
        .filter((c): c is string => typeof c === 'string')
        .filter((c) => c !== '0');
      const withGlobal = [...cleaned, 'global'];
      return Array.from(new Set(withGlobal)).sort((a, b) =>
        a.localeCompare(b),
      );
    }

    return [];
  }, [orgData]);

  const availableFunctionRoots = useMemo(() => {
    if (!orgData) {
      return [];
    }

    const rawFunctions = (orgData as Record<string, unknown>).functions;

    // Backend sends this as a JSON stringified array of strings, similar to countries.
    if (typeof rawFunctions === 'string') {
      try {
        const parsed = JSON.parse(rawFunctions) as unknown;
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (fn): fn is string =>
              typeof fn === 'string' && fn.trim().length > 0,
          );
          return Array.from(new Set(cleaned)).sort((a, b) =>
            a.localeCompare(b),
          );
        }
      } catch {
        return [];
      }
    }

    if (Array.isArray(rawFunctions)) {
      const cleaned = rawFunctions.filter(
        (fn): fn is string => typeof fn === 'string' && fn.trim().length > 0,
      );
      return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
    }

    return [];
  }, [orgData]);

  const countryPercentLabels = useMemo(() => {
    if (!orgData) {
      return {};
    }

    const labels: Record<string, string> = {};
    const analyticsRaw = (orgData as Record<string, unknown>).country_analytics;

    let analytics: Record<string, number> | null = null;

    if (typeof analyticsRaw === 'string') {
      try {
        const parsed = JSON.parse(analyticsRaw) as unknown;
        if (
          parsed &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed)
        ) {
          analytics = Object.entries(parsed as Record<string, unknown>).reduce<
            Record<string, number>
          >((acc, [key, value]) => {
            if (typeof value === 'number') {
              acc[key] = value;
            }
            return acc;
          }, {});
        }
      } catch {
        analytics = null;
      }
    } else if (
      analyticsRaw &&
      typeof analyticsRaw === 'object' &&
      !Array.isArray(analyticsRaw)
    ) {
      analytics = Object.entries(
        analyticsRaw as Record<string, unknown>,
      ).reduce<Record<string, number>>((acc, [key, value]) => {
        if (typeof value === 'number') {
          acc[key] = value;
        }
        return acc;
      }, {});
    }

    if (!analytics) {
      return labels;
    }

    const globalTotal =
      typeof analytics.global === 'number' && analytics.global > 0
        ? analytics.global
        : null;

    const total = globalTotal ?? null;

    if (!total) {
      return labels;
    }

    Object.entries(analytics).forEach(([country, count]) => {
      if (typeof count !== 'number' || count <= 0) {
        return;
      }
      const percent = (count / total) * 100;
      labels[country] = `${percent.toFixed(1)}%`;
    });

    return labels;
  }, [orgData]);

  const functionRootPercentLabels = useMemo(() => {
    if (!orgData) {
      return {};
    }

    const labels: Record<string, string> = {};
    const orgchartStr = (orgData as Record<string, unknown>).orgchart;

    if (typeof orgchartStr !== 'string') {
      return labels;
    }

    try {
      const rawNodes = JSON.parse(orgchartStr) as Array<{
        std_function_root?: string;
        len_candidates?: number;
      }>;

      if (!Array.isArray(rawNodes)) {
        return labels;
      }

      const counts: Record<string, number> = {};

      rawNodes.forEach((node) => {
        const root =
          typeof node.std_function_root === 'string'
            ? node.std_function_root
            : undefined;
        const len =
          typeof node.len_candidates === 'number' ? node.len_candidates : 0;

        if (!root || len <= 0) {
          return;
        }

        counts[root] = (counts[root] ?? 0) + len;
      });

      const total = Object.values(counts).reduce(
        (sum, value) => sum + value,
        0,
      );

      if (!total) {
        return labels;
      }

      counts.fullcompany = total;

      Object.entries(counts).forEach(([root, count]) => {
        if (count <= 0) {
          return;
        }
        const percent = (count / total) * 100;
        labels[root] = `${percent.toFixed(1)}%`;
      });

      return labels;
    } catch {
      return labels;
    }
  }, [orgData]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      years.push(String(currentYear - i));
    }
    return years;
  }, []);

  const handleSearch = () => {
    const handle = diagramHandleRef.current;
    if (!handle) {
      return;
    }

    const count = handle.search(searchTerm);
    setSearchResultCount(count);
  };

  const handleClearSearch = () => {
    const handle = diagramHandleRef.current;
    if (!handle) {
      return;
    }

    handle.clearSearch();
    setSearchTerm('');
    setSearchResultCount(null);
  };

  return (
    <StyledContainer>
      <StyledHeader>
        {onBack && (
          <StyledBackButton type="button" onClick={onBack}>
            ← Back to jobs
          </StyledBackButton>
        )}
        {(companyName ||
          website ||
          locationName ||
          industry ||
          typeof profileCount === 'number') && (
          <StyledCompanyInfo>
            {companyName && (
              <StyledCompanyTitleRow>
                <StyledCompanyTitle>{companyName}</StyledCompanyTitle>
                {linkedinUrl ? (
                  <StyledLinkIcon
                    href={linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open LinkedIn company page"
                  >
                    <IconBrandLinkedin />
                  </StyledLinkIcon>
                ) : website ? (
                  <StyledLinkIcon
                    href={website}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open company website"
                  >
                    <IconWorld />
                  </StyledLinkIcon>
                ) : null}
              </StyledCompanyTitleRow>
            )}
            {(locationName || industry || typeof profileCount === 'number') && (
              <StyledCompanyMetaRow>
                {locationName && <StyledMetaItem>{locationName}</StyledMetaItem>}
                {industry && <StyledMetaItem>{industry}</StyledMetaItem>}
                {typeof profileCount === 'number' && (
                  <StyledMetaItem>
                    {profileCount.toLocaleString()} profiles
                  </StyledMetaItem>
                )}
              </StyledCompanyMetaRow>
            )}
          </StyledCompanyInfo>
        )}
        {orgData && (
          <StyledFiltersContainer>
            <StyledFilterGroup>
              <StyledFilterLabel>Year</StyledFilterLabel>
              <StyledSelect
                value={selectedYear ?? ''}
                onChange={(event) => setSelectedYear(event.target.value)}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {`${year} (100%)`}
                  </option>
                ))}
              </StyledSelect>
            </StyledFilterGroup>
            {availableCountries.length > 0 && (
              <StyledFilterGroup>
                <StyledFilterLabel>Country</StyledFilterLabel>
                <StyledSelect
                  value={selectedCountry ?? ''}
                  onChange={(event) =>
                    setSelectedCountry(
                      event.target.value ? event.target.value : undefined,
                    )
                  }
                >
                  {availableCountries.map((country) => (
                    <option key={country} value={country}>
                      {countryPercentLabels[country]
                        ? `${country} (${countryPercentLabels[country]})`
                        : country}
                    </option>
                  ))}
                </StyledSelect>
              </StyledFilterGroup>
            )}
            {availableFunctionRoots.length > 0 && (
              <StyledFilterGroup>
                <StyledFilterLabel>Function</StyledFilterLabel>
                <StyledSelect
                  value={selectedFunctionRoot ?? ''}
                  onChange={(event) =>
                    setSelectedFunctionRoot(
                      event.target.value ? event.target.value : undefined,
                    )
                  }
                >
                  {availableFunctionRoots.map((fn) => (
                    <option key={fn} value={fn}>
                      {functionRootPercentLabels[fn]
                        ? `${fn} (${functionRootPercentLabels[fn]})`
                        : fn}
                    </option>
                  ))}
                </StyledSelect>
              </StyledFilterGroup>
            )}
            <StyledSearchContainer>
              <StyledSearchInputWrapper>
                <StyledSearchIcon />
                <StyledSearchInput
                  placeholder="Search org chart"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
              </StyledSearchInputWrapper>
              <StyledSearchButton type="button" onClick={handleSearch}>
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
                  onClick={handleClearSearch}
                >
                  Clear
                </StyledSearchButton>
                <StyledSearchMeta>
                  {typeof searchResultCount === 'number' && searchResultCount > 0
                    ? `${searchResultCount} result${
                        searchResultCount === 1 ? '' : 's'
                      }`
                    : ''}
                </StyledSearchMeta>
              </StyledSearchNavGroup>
            </StyledSearchContainer>
          </StyledFiltersContainer>
        )}
      </StyledHeader>
      <StyledDiagramArea>
        {isLoading && (
          <StyledLoadingMessage>Loading org chart...</StyledLoadingMessage>
        )}
        {error && <StyledErrorMessage>{error}</StyledErrorMessage>}
        {!isLoading && !error && nodeDataArray.length > 0 && (
          <OrgChartDiagram
            ref={diagramHandleRef}
            nodeDataArray={nodeDataArray}
          />
        )}
        {!isLoading && !error && data && nodeDataArray.length === 0 && (
          <StyledLoadingMessage>No org chart data available.</StyledLoadingMessage>
        )}
      </StyledDiagramArea>
    </StyledContainer>
  );
};
