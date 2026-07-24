import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import styled from '@emotion/styled';
import {
    IconAdjustmentsHorizontal,
    IconChevronDown,
    IconSearch,
    IconX,
} from '@tabler/icons-react';

import {
    DEFAULT_ORG_CHART_GRADE_VISIBILITY,
    toTitleCase,
    type OrgChartGradeTier,
    type OrgChartGradeVisibility,
} from 'twenty-shared/utils';

import {
    sortOrgChartCountryKeys
} from '../utils/orgChartFilterDropdownSort';
import {
    buildVisibleFunctionRoots,
    formatOrgChartFunctionRootOptionLabel,
} from '../utils/orgChartFunctionRootOptions';
import { OrgChartDiagramHandle } from './OrgChartDiagram.types';

const formatFilterOptionLabel = (
  key: string,
  percentLabels: Record<string, string>,
  countMap: Record<string, number> | undefined,
): string => {
  if (countMap !== undefined) {
    return formatOrgChartFunctionRootOptionLabel(key, percentLabels, countMap);
  }

  const title = toTitleCase(key);
  const pct = percentLabels[key];
  const parts: string[] = [title];
  if (pct) {
    parts.push(pct);
  }
  return parts.join(' · ');
};

const StyledFiltersContainer = styled.div<{ $omitMarginLeft?: boolean }>`
  margin-left: ${({ $omitMarginLeft }) => ($omitMarginLeft ? '0' : 'auto')};
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};
  max-width: 100%;
`;

const StyledDesktopFilters = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(2)};

  @container orgchart-header (max-width: 720px) {
    display: none;
  }
`;

const StyledCompactFilters = styled.div`
  display: none;
  width: 100%;

  @container orgchart-header (max-width: 720px) {
    display: block;
    width: 100%;
  }
`;

const StyledCompactTrigger = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(1.5)};
  width: 100%;
  padding: ${({ theme }) => theme.spacing(1.25)}
    ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-family: ${({ theme }) => theme.font.family};
  cursor: pointer;
  text-align: left;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledCompactTriggerLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(0.25)};
  min-width: 0;
  flex: 1;
`;

const StyledCompactTriggerTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const StyledCompactTriggerSummary = styled.span`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledCompactTriggerMeta = styled.span`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledSheetBackdrop = styled.div<{ $open: boolean }>`
  display: ${({ $open }) => ($open ? 'block' : 'none')};
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(15, 15, 15, 0.45);
`;

const StyledSheetPanel = styled.div<{ $open: boolean }>`
  display: ${({ $open }) => ($open ? 'flex' : 'none')};
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 201;
  max-height: min(78vh, 560px);
  flex-direction: column;
  border-top-left-radius: ${({ theme }) => theme.border.radius.md};
  border-top-right-radius: ${({ theme }) => theme.border.radius.md};
  background: ${({ theme }) => theme.background.primary};
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.12);
  font-family: ${({ theme }) => theme.font.family};
`;

const StyledSheetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(2)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  flex-shrink: 0;
`;

const StyledSheetTitle = styled.span`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledIconButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledSheetBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing(1)} 0
    ${({ theme }) => theme.spacing(3)};
`;

const StyledSheetSectionLabel = styled.div`
  padding: ${({ theme }) => theme.spacing(1.5)}
    ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(0.5)};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const StyledSheetOption = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing(2)};
  width: 100%;
  padding: ${({ theme }) => theme.spacing(1.25)}
    ${({ theme }) => theme.spacing(2)};
  border: none;
  border-left: 3px solid
    ${({ theme, $active }) => ($active ? theme.color.blue : 'transparent')};
  background: ${({ theme, $active }) =>
    $active ? theme.background.transparent.light : 'transparent'};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  text-align: left;
  cursor: pointer;
  font-family: ${({ theme }) => theme.font.family};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledSheetOptionMain = styled.span`
  font-weight: 600;
  word-break: break-word;
`;

const StyledSheetOptionMeta = styled.span`
  flex-shrink: 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  white-space: nowrap;
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
  padding: ${({ theme }) => theme.spacing(1)}
    ${({ theme }) => theme.spacing(1.5)};
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

const StyledSearchViewActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
  margin-left: ${({ theme }) => theme.spacing(2)};
  white-space: nowrap;

  @media (max-width: 720px) {
    display: none;
  }
`;

const StyledGradeFilterWrap = styled.div`
  position: relative;
`;

const StyledGradeFilterTrigger = styled(StyledSearchButton)`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(0.5)};
`;

const StyledGradeFilterMenu = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing(0.5)});
  right: 0;
  z-index: 40;
  min-width: 200px;
  padding: ${({ theme }) => theme.spacing(1)} 0;
  border-radius: ${({ theme }) => theme.border.radius.md};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  background: ${({ theme }) => theme.background.primary};
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
`;

const StyledGradeFilterOption = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1.5)};
  padding: ${({ theme }) => theme.spacing(1)}
    ${({ theme }) => theme.spacing(1.5)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }

  input {
    margin: 0;
    cursor: pointer;
  }
`;

export type OrgChartFiltersProps = {
  availableCountries: string[];
  countryPercentLabels: Record<string, string>;
  /** Headcount-style totals per country key when provided by org payload. */
  countryCounts?: Record<string, number>;
  selectedCountry: string | undefined;
  onCountryChange: (country: string | undefined) => void;
  availableFunctionRoots: string[];
  functionRootPercentLabels: Record<string, string>;
  /** Candidate counts summed from org chart nodes per function root. */
  functionRootCounts?: Record<string, number>;
  selectedFunctionRoot: string | undefined;
  onFunctionRootChange: (fn: string | undefined) => void;
  /** When true, do not push filters to the far right (parent handles layout). */
  omitMarginLeft?: boolean;
  /** Blank preview template — merge standard function roots into the dropdown. */
  isBlankTemplate?: boolean;
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
  gradeVisibility?: OrgChartGradeVisibility;
  onGradeVisibilityChange?: (
    tier: OrgChartGradeTier,
    checked: boolean,
  ) => void;
};

const GRADE_FILTER_OPTIONS: Array<{
  tier: OrgChartGradeTier;
  label: string;
}> = [
  { tier: 'leadership', label: 'Show leadership' },
  { tier: 'managers', label: 'Show managers' },
  { tier: 'executives', label: 'Show executives' },
];

const OrgChartGradeFilterDropdown = ({
  gradeVisibility,
  onGradeVisibilityChange,
}: {
  gradeVisibility: OrgChartGradeVisibility;
  onGradeVisibilityChange: (tier: OrgChartGradeTier, checked: boolean) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const activeCount = GRADE_FILTER_OPTIONS.filter(
    ({ tier }) => gradeVisibility[tier],
  ).length;

  return (
    <StyledGradeFilterWrap ref={wrapRef}>
      <StyledGradeFilterTrigger
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((open) => !open)}
      >
        Levels{activeCount < 3 ? ` (${activeCount})` : ''}
        <IconChevronDown size={14} aria-hidden />
      </StyledGradeFilterTrigger>
      {isOpen ? (
        <StyledGradeFilterMenu role="menu">
          {GRADE_FILTER_OPTIONS.map(({ tier, label }) => (
            <StyledGradeFilterOption key={tier} role="menuitemcheckbox">
              <input
                type="checkbox"
                checked={gradeVisibility[tier]}
                onChange={(event) => {
                  onGradeVisibilityChange(tier, event.target.checked);
                }}
              />
              {label}
            </StyledGradeFilterOption>
          ))}
        </StyledGradeFilterMenu>
      ) : null}
    </StyledGradeFilterWrap>
  );
};

export const OrgChartFilters = ({
  availableCountries,
  countryPercentLabels,
  countryCounts,
  selectedCountry,
  onCountryChange,
  availableFunctionRoots,
  functionRootPercentLabels,
  functionRootCounts,
  selectedFunctionRoot,
  onFunctionRootChange,
  omitMarginLeft,
  isBlankTemplate,
}: OrgChartFiltersProps) => {
  const [isCompactSheetOpen, setIsCompactSheetOpen] = useState(false);

  const countryOptionsForSelect = useMemo(() => {
    if (!selectedCountry) return availableCountries;
    if (availableCountries.includes(selectedCountry)) {
      return availableCountries;
    }
    return sortOrgChartCountryKeys(
      [...availableCountries, selectedCountry],
      countryPercentLabels,
    );
  }, [availableCountries, countryPercentLabels, selectedCountry]);

  const visibleFunctionRoots = useMemo(
    () =>
      buildVisibleFunctionRoots({
        availableFunctionRoots,
        functionRootPercentLabels,
        selectedFunctionRoot,
        isBlankTemplate,
        includePreviewFunctionRoots: true,
      }),
    [
      availableFunctionRoots,
      functionRootPercentLabels,
      selectedFunctionRoot,
      isBlankTemplate,
    ],
  );

  const effectiveCountryKey = selectedCountry ?? 'global';
  const effectiveFunctionKey = selectedFunctionRoot ?? 'fullcompany';

  const compactSummaryLine = `${toTitleCase(effectiveCountryKey)} · ${toTitleCase(effectiveFunctionKey)}`;

  const scopePeopleSummary = useMemo(() => {
    const fnCount = functionRootCounts?.[effectiveFunctionKey];
    if (typeof fnCount === 'number' && fnCount > 0) {
      return `${fnCount.toLocaleString()} people in this view`;
    }
    const cCount = countryCounts?.[effectiveCountryKey];
    if (typeof cCount === 'number' && cCount > 0) {
      return `${cCount.toLocaleString()} people in dataset`;
    }
    return '';
  }, [
    countryCounts,
    functionRootCounts,
    effectiveCountryKey,
    effectiveFunctionKey,
  ]);

  const closeCompactSheet = useCallback(() => {
    setIsCompactSheetOpen(false);
  }, []);

  useEffect(() => {
    if (!isCompactSheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCompactSheet();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCompactSheetOpen, closeCompactSheet]);

  useEffect(() => {
    if (!isCompactSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isCompactSheetOpen]);

  const formatOptionMeta = (
    key: string,
    percentLabels: Record<string, string>,
    countMap: Record<string, number> | undefined,
  ): string => {
    const count = countMap?.[key];
    const pct = percentLabels[key];
    const bits: string[] = [];
    if (typeof count === 'number' && count > 0) {
      bits.push(count.toLocaleString());
    }
    if (pct) bits.push(pct);
    return bits.join(' · ');
  };

  const renderDesktopSelects = () => (
    <StyledDesktopFilters>
      {countryOptionsForSelect.length > 0 && (
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
            {countryOptionsForSelect.map((country) => (
              <option key={country} value={country}>
                {formatFilterOptionLabel(
                  country,
                  countryPercentLabels,
                  countryCounts,
                )}
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
                {formatFilterOptionLabel(
                  fn,
                  functionRootPercentLabels,
                  functionRootCounts,
                )}
              </option>
            ))}
          </StyledSelect>
        </StyledFilterGroup>
      )}
    </StyledDesktopFilters>
  );

  const renderCompactChrome = () => {
    const hasAny =
      countryOptionsForSelect.length > 0 || visibleFunctionRoots.length > 0;
    if (!hasAny) return null;

    return (
      <>
        <StyledSheetBackdrop
          $open={isCompactSheetOpen}
          aria-hidden={!isCompactSheetOpen}
          onClick={closeCompactSheet}
        />
        <StyledSheetPanel
          $open={isCompactSheetOpen}
          role="dialog"
          aria-modal="true"
          aria-labelledby="orgchart-scope-sheet-title"
          onClick={(e) => e.stopPropagation()}
        >
          <StyledSheetHeader>
            <StyledSheetTitle id="orgchart-scope-sheet-title">
              Org chart scope
            </StyledSheetTitle>
            <StyledIconButton
              type="button"
              aria-label="Close"
              onClick={closeCompactSheet}
            >
              <IconX size={20} />
            </StyledIconButton>
          </StyledSheetHeader>
          <StyledSheetBody>
            {countryOptionsForSelect.length > 0 && (
              <>
                <StyledSheetSectionLabel>Region</StyledSheetSectionLabel>
                {countryOptionsForSelect.map((country) => {
                  const active = (selectedCountry ?? 'global') === country;
                  return (
                    <StyledSheetOption
                      key={country}
                      type="button"
                      $active={!!active}
                      onClick={() => {
                        onCountryChange(country);
                        closeCompactSheet();
                      }}
                    >
                      <StyledSheetOptionMain>
                        {toTitleCase(country)}
                      </StyledSheetOptionMain>
                      <StyledSheetOptionMeta>
                        {formatOptionMeta(
                          country,
                          countryPercentLabels,
                          countryCounts,
                        )}
                      </StyledSheetOptionMeta>
                    </StyledSheetOption>
                  );
                })}
              </>
            )}
            {visibleFunctionRoots.length > 0 && (
              <>
                <StyledSheetSectionLabel>Function</StyledSheetSectionLabel>
                {visibleFunctionRoots.map((fn) => {
                  const active = (selectedFunctionRoot ?? 'fullcompany') === fn;
                  return (
                    <StyledSheetOption
                      key={fn}
                      type="button"
                      $active={!!active}
                      onClick={() => {
                        onFunctionRootChange(fn);
                        closeCompactSheet();
                      }}
                    >
                      <StyledSheetOptionMain>
                        {toTitleCase(fn)}
                      </StyledSheetOptionMain>
                      <StyledSheetOptionMeta>
                        {formatOptionMeta(
                          fn,
                          functionRootPercentLabels,
                          functionRootCounts,
                        )}
                      </StyledSheetOptionMeta>
                    </StyledSheetOption>
                  );
                })}
              </>
            )}
          </StyledSheetBody>
        </StyledSheetPanel>
      </>
    );
  };

  return (
    <StyledFiltersContainer $omitMarginLeft={omitMarginLeft}>
      {renderDesktopSelects()}
      {(countryOptionsForSelect.length > 0 ||
        visibleFunctionRoots.length > 0) && (
        <StyledCompactFilters>
          <StyledCompactTrigger
            type="button"
            aria-expanded={isCompactSheetOpen}
            aria-haspopup="dialog"
            onClick={() => setIsCompactSheetOpen((open) => !open)}
          >
            <StyledCompactTriggerLeft>
              <StyledCompactTriggerTitleRow>
                <IconAdjustmentsHorizontal size={16} aria-hidden />
                Scope
              </StyledCompactTriggerTitleRow>
              <StyledCompactTriggerSummary>
                {compactSummaryLine}
              </StyledCompactTriggerSummary>
              {scopePeopleSummary ? (
                <StyledCompactTriggerMeta>
                  {scopePeopleSummary}
                </StyledCompactTriggerMeta>
              ) : null}
            </StyledCompactTriggerLeft>
            <IconChevronDown size={18} aria-hidden />
          </StyledCompactTrigger>
          {isCompactSheetOpen ? renderCompactChrome() : null}
        </StyledCompactFilters>
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
  gradeVisibility = DEFAULT_ORG_CHART_GRADE_VISIBILITY,
  onGradeVisibilityChange,
}: OrgChartSearchControlsProps) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isOrgChartSearchShortcut =
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === 'f';
      if (!isOrgChartSearchShortcut) return;
      event.preventDefault();
      event.stopPropagation();
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  return (
    <StyledSearchContainer>
      <StyledSearchInputWrapper>
        <StyledSearchIcon />
        <StyledSearchInput
          ref={searchInputRef}
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
        <StyledSearchViewActions>
          <StyledSearchButton
            type="button"
            onClick={() => diagramHandleRef.current?.centerContent()}
          >
            Center
          </StyledSearchButton>
          <StyledSearchButton
            type="button"
            onClick={() => diagramHandleRef.current?.zoomToFit()}
          >
            Zoom to fit
          </StyledSearchButton>
          {onGradeVisibilityChange ? (
            <OrgChartGradeFilterDropdown
              gradeVisibility={gradeVisibility}
              onGradeVisibilityChange={onGradeVisibilityChange}
            />
          ) : null}
        </StyledSearchViewActions>
        <StyledSearchMeta>
          {typeof searchResultCount === 'number' && searchResultCount > 0
            ? `${searchResultCount} result${searchResultCount === 1 ? '' : 's'}`
            : ''}
        </StyledSearchMeta>
      </StyledSearchNavGroup>
    </StyledSearchContainer>
  );
};
