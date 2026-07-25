import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { resolveOrgChartCanonicalCompanyId, toTitleCase } from 'twenty-shared/utils';

import {
    CompanyAutocompleteItem,
    useCompanyAutocomplete,
} from '../hooks/useCompanyAutocomplete';

export type CompanySearchAutocompleteProps = {
  onCompanySelect: (company: {
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
    companyDomain?: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Icon to show inside the input on the left */
  startIcon?: React.ReactNode;
  /** When true, shows loading spinner (e.g. during navigation after selection) */
  isSelecting?: boolean;
  /** Smaller control for tight toolbars (e.g. mobile site header). */
  dense?: boolean;
  /** Base URL for API (e.g. https://server.com or /api/org-chart for proxy) */
  baseUrl: string;
  accessToken?: string;
  /** Path to autocomplete endpoint. Default: /org-chart/companies/autocomplete. Use /autocomplete for Next.js proxy. */
  autocompletePath?: string;
  /** Base URL for company logo. Default: same as baseUrl + /org-chart/company-logo. Use /company-logo for proxy. */
  logoBaseUrl?: string;
};

const DROPDOWN_MIN_WIDTH = 520;
const DROPDOWN_MAX_HEIGHT = 360;
const DROPDOWN_PORTAL_Z_INDEX = 10000;

const INPUT_DENSE_FONT_SIZE = themeCssVariables.font.size.sm;
const INPUT_NORMAL_FONT_SIZE = themeCssVariables.font.size.md;

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

const StyledWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const StyledInput = styled.input<{ $hasStartIcon?: boolean; $dense?: boolean }>`
  width: 100%;
  padding-top: ${({ $dense }) =>
    $dense ? themeCssVariables.spacing['1'] : themeCssVariables.spacing['2']};
  padding-bottom: ${({ $dense }) =>
    $dense ? themeCssVariables.spacing['1'] : themeCssVariables.spacing['2']};
  padding-right: ${({ $dense }) =>
    $dense ? themeCssVariables.spacing['2'] : themeCssVariables.spacing['3']};
  padding-left: ${({ $hasStartIcon, $dense }) => {
    if ($hasStartIcon) {
      return $dense ? '34px' : '44px';
    }

    return $dense
      ? themeCssVariables.spacing['2']
      : themeCssVariables.spacing['3'];
  }};
  font-size: ${({ $dense }) =>
    $dense ? INPUT_DENSE_FONT_SIZE : INPUT_NORMAL_FONT_SIZE};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }

  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StyledDropdown = styled.ul<{
  $top: number;
  $left: number;
  $width: number;
}>`
  position: fixed;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: ${({ $width }) => $width}px;
  min-width: ${DROPDOWN_MIN_WIDTH}px;
  max-width: calc(100vw - 16px);
  max-height: ${DROPDOWN_MAX_HEIGHT}px;
  overflow-y: auto;
  overflow-x: hidden;
  margin: 0;
  padding: ${themeCssVariables.spacing['2']};
  list-style: none;
  text-align: left;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.xl};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  z-index: ${DROPDOWN_PORTAL_Z_INDEX};

  @media (max-width: 809px) {
    min-width: 0;
  }
`;

const StyledDropdownItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing['3']};
  padding: calc(
      ${themeCssVariables.spacing['2']} + ${themeCssVariables.spacing['0.5']}
    )
    ${themeCssVariables.spacing['3']};
  cursor: pointer;
  border-radius: ${themeCssVariables.border.radius.md};
  transition:
    background 0.15s ease,
    color 0.15s ease;
  margin-bottom: ${themeCssVariables.spacing['0.5']};

  &:last-of-type {
    margin-bottom: 0;
  }

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }

  &:active {
    background: ${themeCssVariables.background.transparent.medium};
  }
`;

const StyledLogo = styled.img`
  width: 40px;
  height: 40px;
  border-radius: ${themeCssVariables.border.radius.md};
  object-fit: contain;
  flex-shrink: 0;
  background: ${themeCssVariables.background.tertiary};
`;

const StyledLogoPlaceholder = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${themeCssVariables.border.radius.md};
  flex-shrink: 0;
  background: ${themeCssVariables.background.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.tertiary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledItemContent = styled.div`
  min-width: 0;
  flex: 1;
`;

const StyledCompanyName = styled.div`
  font-weight: ${themeCssVariables.font.weight.medium};
  font-size: ${themeCssVariables.font.size.md};
  color: ${themeCssVariables.font.color.primary};
  margin-bottom: ${themeCssVariables.spacing['1']};
  line-height: 1.3;
  overflow-wrap: break-word;
  word-break: break-word;
`;

const StyledCompanyMeta = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.tertiary};
  line-height: 1.4;
  overflow-wrap: break-word;
  word-break: break-word;

  span:not(:last-child)::after {
    content: ' · ';
    margin: 0 ${themeCssVariables.spacing['1']};
  }
`;

const StyledEmptyMessage = styled.div`
  padding: ${themeCssVariables.spacing['3']};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.tertiary};
  text-align: center;
`;

const StyledErrorMessage = styled.div`
  padding: ${themeCssVariables.spacing['3']};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.tertiary};
  text-align: center;
`;

const StyledSpinner = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid ${themeCssVariables.border.color.light};
  border-top-color: black;
  animation: company-search-spin 0.8s linear infinite;

  @keyframes company-search-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const StyledInputWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const StyledStartIcon = styled.span<{ $dense?: boolean }>`
  position: absolute;
  left: ${({ $dense }) =>
    $dense ? themeCssVariables.spacing['1'] : themeCssVariables.spacing['2']};
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${themeCssVariables.font.color.tertiary};
  pointer-events: none;
`;

const StyledInputSpinner = styled.div`
  position: absolute;
  right: ${themeCssVariables.spacing['3']};
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
`;

export const CompanySearchAutocomplete = ({
  onCompanySelect,
  placeholder = 'Search for a company...',
  disabled = false,
  isSelecting = false,
  dense = false,
  baseUrl,
  accessToken,
  autocompletePath,
  logoBaseUrl,
  startIcon,
}: CompanySearchAutocompleteProps) => {
  const deriveCompanyDomain = useCallback((website?: string) => {
    const raw = website?.trim();
    if (!raw) return undefined;
    try {
      const normalized =
        raw.startsWith('http://') || raw.startsWith('https://')
          ? raw
          : `https://${raw}`;
      const host = new URL(normalized).hostname.trim().toLowerCase();
      return host || undefined;
    } catch {
      return raw.toLowerCase();
    }
  }, []);

  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({
    top: 0,
    left: 0,
    width: DROPDOWN_MIN_WIDTH,
  });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const updateDropdownPosition = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const width = Math.min(
      Math.max(rect.width, DROPDOWN_MIN_WIDTH),
      viewportWidth - 16,
    );
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, viewportWidth - width - 8),
    );

    setDropdownPosition({
      top: rect.bottom + 8,
      left,
      width,
    });
  }, []);

  const { companies, isLoading, error, search, clear } = useCompanyAutocomplete(
    {
      baseUrl,
      accessToken,
      autocompletePath,
    },
  );

  const showDropdown = isOpen && inputValue.trim().length > 0;

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      search(value);
      setIsOpen(true);
      if (!value) clear();
    },
    [search, clear],
  );

  const handleSelect = useCallback(
    (company: CompanyAutocompleteItem) => {
      const linkedinUrl = company.meta.linkedin_slug
        ? `https://www.linkedin.com/company/${company.meta.linkedin_slug}/`
        : company.meta.linkedin_url;

      onCompanySelect({
        companyId: resolveOrgChartCanonicalCompanyId(company.meta.id),
        companyName: company.name,
        website: company.meta.website,
        companyDomain: deriveCompanyDomain(company.meta.website),
        locationName: company.meta.location_name,
        industry: company.meta.industry,
        profileCount: company.count,
        linkedinUrl,
      });
      setInputValue('');
      setIsOpen(false);
      clear();
    },
    [deriveCompanyDomain, onCompanySelect, clear],
  );

  const handleBlur = useCallback(() => {
    setTimeout(() => setIsOpen(false), 200);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideWrapper = wrapperRef.current?.contains(target);
      const isInsideDropdown = dropdownRef.current?.contains(target);
      if (!isInsideWrapper && !isInsideDropdown) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;

    updateDropdownPosition();

    const handleLayoutChange = () => {
      updateDropdownPosition();
    };

    window.addEventListener('resize', handleLayoutChange);
    window.addEventListener('scroll', handleLayoutChange, true);

    return () => {
      window.removeEventListener('resize', handleLayoutChange);
      window.removeEventListener('scroll', handleLayoutChange, true);
    };
  }, [showDropdown, updateDropdownPosition]);

  const getLogoUrl = useCallback(
    (website: string | undefined) => {
      if (!website?.trim()) return null;
      const base =
        logoBaseUrl ?? `${baseUrl.replace(/\/$/, '')}/org-chart/company-logo`;
      return `${base.replace(/\/$/, '')}?website=${encodeURIComponent(website)}`;
    },
    [baseUrl, logoBaseUrl],
  );

  const dropdownList = (
    <StyledDropdown
      ref={dropdownRef}
      $top={dropdownPosition.top}
      $left={dropdownPosition.left}
      $width={dropdownPosition.width}
      onMouseDown={(e) => e.preventDefault()}
    >
      {isLoading ? (
        <StyledEmptyMessage>Searching...</StyledEmptyMessage>
      ) : error ? (
        <StyledErrorMessage>
          Unable to search. Please try again.
        </StyledErrorMessage>
      ) : companies.length === 0 ? (
        <StyledEmptyMessage>No companies found</StyledEmptyMessage>
      ) : (
        companies.map((company) => {
          const logoUrl = getLogoUrl(company.meta.website);
          const initials = company.name
            .split(/\s+/)
            .map((w) => w[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          return (
            <StyledDropdownItem
              key={company.meta.id}
              role="option"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(company);
              }}
            >
              {logoUrl ? (
                <StyledLogo
                  src={logoUrl}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const placeholder = e.currentTarget.nextElementSibling;
                    if (placeholder instanceof HTMLElement) {
                      placeholder.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <StyledLogoPlaceholder
                style={{ display: logoUrl ? 'none' : 'flex' }}
                aria-hidden
              >
                {initials || '?'}
              </StyledLogoPlaceholder>
              <StyledItemContent>
                <StyledCompanyName>
                  {toTitleCase(company.name)}
                </StyledCompanyName>
                <StyledCompanyMeta>
                  {company.meta.location_name && (
                    <span>{toTitleCase(company.meta.location_name)}</span>
                  )}
                  {company.meta.industry && (
                    <span>{toTitleCase(company.meta.industry)}</span>
                  )}
                  <span>{company.count.toLocaleString()} profiles</span>
                </StyledCompanyMeta>
              </StyledItemContent>
            </StyledDropdownItem>
          );
        })
      )}
    </StyledDropdown>
  );

  const dropdownContent =
    showDropdown && typeof document !== 'undefined'
      ? createPortal(dropdownList, document.body)
      : null;

  return (
    <StyledWrapper ref={wrapperRef}>
      <StyledInputWrapper>
        {startIcon && (
          <StyledStartIcon aria-hidden $dense={dense}>
            {startIcon}
          </StyledStartIcon>
        )}
        <StyledInput
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={() => companies.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled || isSelecting}
          autoComplete="off"
          $hasStartIcon={!!startIcon}
          $dense={dense}
        />
        {isSelecting && (
          <StyledInputSpinner>
            <StyledSpinner />
          </StyledInputSpinner>
        )}
      </StyledInputWrapper>
      {dropdownContent}
    </StyledWrapper>
  );
};
