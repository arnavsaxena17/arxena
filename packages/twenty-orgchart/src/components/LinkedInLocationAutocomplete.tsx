import styled from '@emotion/styled';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
    LinkedInLocationAutocompleteItem,
    useLinkedInLocationAutocomplete,
} from '../hooks/useLinkedInLocationAutocomplete';

export type LinkedInLocationAutocompleteProps = {
  baseUrl: string;
  accessToken?: string;
  linkedinUnipileAccountId?: string;
  placeholder?: string;
  disabled?: boolean;
  selectedLocation?: LinkedInLocationAutocompleteItem | null;
  onLocationSelect: (location: LinkedInLocationAutocompleteItem | null) => void;
};

const DROPDOWN_MIN_WIDTH = 420;
const DROPDOWN_MAX_HEIGHT = 280;
const DROPDOWN_PORTAL_Z_INDEX = 10000;

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

const StyledWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};

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
  margin: 0;
  padding: ${({ theme }) => theme.spacing(1)};
  list-style: none;
  background: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.md};
  box-shadow: ${({ theme }) => theme.boxShadow.strong};
  z-index: ${DROPDOWN_PORTAL_Z_INDEX};
`;

const StyledDropdownItem = styled.li`
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};

  &:hover {
    background: ${({ theme }) => theme.background.transparent.light};
  }
`;

const StyledEmptyMessage = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-align: center;
`;

const StyledClearButton = styled.button`
  position: absolute;
  right: ${({ theme }) => theme.spacing(1)};
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.font.color.tertiary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.xs};
`;

export const LinkedInLocationAutocomplete = ({
  baseUrl,
  accessToken,
  linkedinUnipileAccountId,
  placeholder = 'Search LinkedIn location...',
  disabled = false,
  selectedLocation,
  onLocationSelect,
}: LinkedInLocationAutocompleteProps) => {
  const [inputValue, setInputValue] = useState(selectedLocation?.title ?? '');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition>({
    top: 0,
    left: 0,
    width: DROPDOWN_MIN_WIDTH,
  });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  const { locations, isLoading, error, search, clear } =
    useLinkedInLocationAutocomplete({
      baseUrl,
      accessToken,
      linkedinUnipileAccountId,
    });

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

  const showDropdown = isOpen && inputValue.trim().length > 0;

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setInputValue(value);
      if (!value.trim()) {
        onLocationSelect(null);
        clear();
        return;
      }
      search(value);
      setIsOpen(true);
    },
    [clear, onLocationSelect, search],
  );

  const handleSelect = useCallback(
    (location: LinkedInLocationAutocompleteItem) => {
      onLocationSelect(location);
      setInputValue(location.title);
      setIsOpen(false);
      clear();
    },
    [clear, onLocationSelect],
  );

  useEffect(() => {
    setInputValue(selectedLocation?.title ?? '');
  }, [selectedLocation?.id, selectedLocation?.title]);

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
    const handleLayoutChange = () => updateDropdownPosition();
    window.addEventListener('resize', handleLayoutChange);
    window.addEventListener('scroll', handleLayoutChange, true);
    return () => {
      window.removeEventListener('resize', handleLayoutChange);
      window.removeEventListener('scroll', handleLayoutChange, true);
    };
  }, [showDropdown, updateDropdownPosition]);

  const dropdownList = (
    <StyledDropdown
      ref={dropdownRef}
      $top={dropdownPosition.top}
      $left={dropdownPosition.left}
      $width={dropdownPosition.width}
      onMouseDown={(event) => event.preventDefault()}
    >
      {isLoading ? (
        <StyledEmptyMessage>Searching...</StyledEmptyMessage>
      ) : error ? (
        <StyledEmptyMessage>{error}</StyledEmptyMessage>
      ) : locations.length === 0 ? (
        <StyledEmptyMessage>No locations found</StyledEmptyMessage>
      ) : (
        locations.map((location) => (
          <StyledDropdownItem
            key={location.id}
            role="option"
            onMouseDown={(event) => {
              event.preventDefault();
              handleSelect(location);
            }}
          >
            {location.title}
          </StyledDropdownItem>
        ))
      )}
    </StyledDropdown>
  );

  return (
    <StyledWrapper ref={wrapperRef}>
      <StyledInput
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => locations.length > 0 && setIsOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />
      {selectedLocation ? (
        <StyledClearButton
          type="button"
          onClick={() => {
            onLocationSelect(null);
            setInputValue('');
            clear();
          }}
        >
          Clear
        </StyledClearButton>
      ) : null}
      {showDropdown && typeof document !== 'undefined'
        ? createPortal(dropdownList, document.body)
        : null}
    </StyledWrapper>
  );
};
