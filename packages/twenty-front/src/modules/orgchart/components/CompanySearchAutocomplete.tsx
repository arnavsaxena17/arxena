import styled from '@emotion/styled';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
};

const StyledWrapper = styled.div`
  position: relative;
  width: 100%;
  z-index: 1;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
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

const DROPDOWN_MIN_WIDTH = 520;
const DROPDOWN_MAX_HEIGHT = 360;

const StyledDropdown = styled.ul<{ top: number; left: number; width: number }>`
  position: fixed;
  top: ${({ top }) => top}px;
  left: ${({ left }) => left}px;
  width: ${({ width }) => width}px;
  min-width: ${DROPDOWN_MIN_WIDTH}px;
  max-height: ${DROPDOWN_MAX_HEIGHT}px;
  overflow-y: auto;
  margin: 0;
  padding: ${({ theme }) => theme.spacing(2)};
  list-style: none;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  z-index: 9999;
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
`;

const StyledCompanyMeta = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  line-height: 1.4;

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

export const CompanySearchAutocomplete = ({
  onCompanySelect,
  placeholder = 'Search for a company...',
  disabled = false,
}: CompanySearchAutocompleteProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const { companies, isLoading, search, clear } = useCompanyAutocomplete();

  const updateDropdownPosition = useCallback(() => {
    const input = inputRef.current;
    if (input) {
      const rect = input.getBoundingClientRect();
      const dropdownWidth = Math.max(rect.width, DROPDOWN_MIN_WIDTH);
      setDropdownRect({
        top: rect.bottom + 8,
        left: rect.left,
        width: dropdownWidth,
      });
    }
  }, []);

  const showDropdown = isOpen && inputValue.trim().length > 0;

  useLayoutEffect(() => {
    if (showDropdown) {
      updateDropdownPosition();
    }
  }, [showDropdown, companies, isLoading, updateDropdownPosition]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      search(value);
      setIsOpen(true);
      if (!value) {
        clear();
      }
    },
    [search, clear],
  );

  const handleSelect = useCallback(
    (company: CompanyAutocompleteItem) => {
      onCompanySelect({
        companyId: company.meta.id,
        companyName: company.name,
        website: company.meta.website,
        locationName: company.meta.location_name,
        industry: company.meta.industry,
        profileCount: company.count,
        linkedinUrl: company.meta.linkedin_url,
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
      if (!isInsideWrapper && !isInsideDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLogoUrl = useCallback((website: string | undefined) => {
    if (!website?.trim()) return null;
    const base =
      process.env.REACT_APP_SERVER_BASE_URL ?? '';
    if (!base) return null;
    return `${base.replace(/\/$/, '')}/org-chart/company-logo?website=${encodeURIComponent(website)}`;
  }, []);

  const dropdownContent = showDropdown && (
    <StyledDropdown
      ref={dropdownRef}
      top={dropdownRect.top}
      left={dropdownRect.left}
      width={dropdownRect.width}
      onMouseDown={(e) => e.preventDefault()}
    >
      {isLoading ? (
        <StyledEmptyMessage>Loading...</StyledEmptyMessage>
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
                style={{
                  display: logoUrl ? 'none' : 'flex',
                }}
                aria-hidden
              >
                {initials || '?'}
              </StyledLogoPlaceholder>
              <StyledItemContent>
                <StyledCompanyName>{company.name}</StyledCompanyName>
                <StyledCompanyMeta>
                  {company.meta.location_name && (
                    <span>{company.meta.location_name}</span>
                  )}
                  {company.meta.industry && (
                    <span>{company.meta.industry}</span>
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
      <StyledInput
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onFocus={() => companies.length > 0 && setIsOpen(true)}
        placeholder={placeholder}
        // disabled={disabled}
        autoComplete="off"
      />
      {dropdownContent &&
        createPortal(dropdownContent, document.body)}
    </StyledWrapper>
  );
};
