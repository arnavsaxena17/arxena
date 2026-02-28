import styled from '@emotion/styled';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { toTitleCase } from 'twenty-shared';

import type { CompanyAutocompleteItem } from '../hooks/useCompanyAutocomplete';
import { useCompanyAutocomplete } from '../hooks/useCompanyAutocomplete';

export type CompanySearchAutocompleteProps = {
  onCompanySelect: (company: {
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Icon to show inside the input on the left */
  startIcon?: React.ReactNode;
  /** When true, shows loading spinner (e.g. during navigation after selection) */
  isSelecting?: boolean;
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

const StyledWrapper = styled.div`
  position: relative;
  width: 100%;
  z-index: 1;
`;

const StyledInput = styled.input<{ $hasStartIcon?: boolean }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  ${({ $hasStartIcon }) => $hasStartIcon && 'padding-left: 44px;'}
  font-size: ${({ theme }) => theme.font.size.md};
  font-family: ${({ theme }) => theme.font.family};
  color: ${({ theme }) => theme.font.color.primary};
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StyledDropdown = styled.ul<{ top: number; left: number; width: number }>`
  position: fixed;
  top: ${({ top }) => top}px;
  left: ${({ left }) => left}px;
  width: ${({ width }) => width}px;
  min-width: ${DROPDOWN_MIN_WIDTH}px;
  max-width: calc(100vw - 16px);
  max-height: ${DROPDOWN_MAX_HEIGHT}px;
  overflow-y: auto;
  overflow-x: hidden;
  margin: 0;
  padding: ${({ theme }) => theme.spacing(2)};
  list-style: none;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  z-index: 9999;

  @media (max-width: 809px) {
    min-width: 0;
  }
`;

const StyledDropdownItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(2.5)} ${({ theme }) => theme.spacing(3)};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.border.radius.md};
  transition: background 0.15s ease, color 0.15s ease;
  margin-bottom: ${({ theme }) => theme.spacing(0.5)};

  &:last-of-type {
    margin-bottom: 0;
  }

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }

  &:active {
    background: ${({ theme }) => theme.background.transparent.medium};
  }
`;

const StyledLogo = styled.img`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.border.radius.md};
  object-fit: contain;
  flex-shrink: 0;
  background: ${({ theme }) => theme.background.tertiary};
`;

const StyledLogoPlaceholder = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.border.radius.md};
  flex-shrink: 0;
  background: ${({ theme }) => theme.background.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const StyledItemContent = styled.div`
  min-width: 0;
  flex: 1;
`;

const StyledCompanyName = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  font-size: ${({ theme }) => theme.font.size.md};
  color: ${({ theme }) => theme.font.color.primary};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
  line-height: 1.3;
  overflow-wrap: break-word;
  word-break: break-word;
`;

const StyledCompanyMeta = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  line-height: 1.4;
  overflow-wrap: break-word;
  word-break: break-word;

  span:not(:last-child)::after {
    content: ' · ';
    margin: 0 ${({ theme }) => theme.spacing(1)};
  }
`;

const StyledEmptyMessage = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-align: center;
`;

const StyledErrorMessage = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-align: center;
`;

const StyledSpinner = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid ${({ theme }) => theme.border.color.light};
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

const StyledStartIcon = styled.span`
  position: absolute;
  left: ${({ theme }) => theme.spacing(2)};
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  pointer-events: none;
`;

const StyledInputSpinner = styled.div`
  position: absolute;
  right: ${({ theme }) => theme.spacing(3)};
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
`;

export const CompanySearchAutocomplete = ({
  onCompanySelect,
  placeholder = 'Search for a company...',
  disabled = false,
  isSelecting = false,
  baseUrl,
  accessToken,
  autocompletePath,
  logoBaseUrl,
  startIcon,
}: CompanySearchAutocompleteProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const { companies, isLoading, error, search, clear } = useCompanyAutocomplete({
    baseUrl,
    accessToken,
    autocompletePath,
  });

  const updateDropdownPosition = useCallback(() => {
    const input = inputRef.current;
    if (input && typeof window !== 'undefined') {
      const rect = input.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const isMobile = viewportWidth < 810;
      const dropdownWidth = isMobile
        ? Math.min(rect.width, viewportWidth - 16)
        : Math.max(rect.width, DROPDOWN_MIN_WIDTH);
      const left = isMobile
        ? Math.max(8, Math.min(rect.left, viewportWidth - dropdownWidth - 8))
        : Math.max(
            8,
            rect.left + (rect.width - dropdownWidth) / 2,
          );
      setDropdownRect({
        top: rect.bottom + 8,
        left,
        width: dropdownWidth,
      });
    }
  }, []);

  const showDropdown = isOpen && inputValue.trim().length > 0;

  useLayoutEffect(() => {
    if (showDropdown) updateDropdownPosition();
  }, [showDropdown, companies, isLoading, updateDropdownPosition]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleResize = () => updateDropdownPosition();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showDropdown, updateDropdownPosition]);

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
        companyId: company.meta.id,
        companyName: company.name,
        website: company.meta.website,
        locationName: company.meta.location_name,
        industry: company.meta.industry,
        profileCount: company.count,
        linkedinUrl,
      });
      setInputValue(company.name);
      setIsOpen(false);
      clear();
    },
    [onCompanySelect, clear],
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

  const getLogoUrl = useCallback(
    (website: string | undefined) => {
      if (!website?.trim()) return null;
      const base = logoBaseUrl ?? `${baseUrl.replace(/\/$/, '')}/org-chart/company-logo`;
      return `${base.replace(/\/$/, '')}?website=${encodeURIComponent(website)}`;
    },
    [baseUrl, logoBaseUrl],
  );

  const dropdownContent = showDropdown && (
    <StyledDropdown
      ref={dropdownRef}
      top={dropdownRect.top}
      left={dropdownRect.left}
      width={dropdownRect.width}
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

  return (
    <StyledWrapper ref={wrapperRef}>
      <StyledInputWrapper>
        {startIcon && <StyledStartIcon aria-hidden>{startIcon}</StyledStartIcon>}
        <StyledInput
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={() => companies.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled || isSelecting}
          autoComplete="off"
          $hasStartIcon={!!startIcon}
        />
        {isSelecting && (
          <StyledInputSpinner>
            <StyledSpinner />
          </StyledInputSpinner>
        )}
      </StyledInputWrapper>
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </StyledWrapper>
  );
};
