import { useCallback, useEffect, useRef, useState } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { createPortal } from 'react-dom';
import { useDebouncedCallback } from 'use-debounce';

import type { SuperImposeAutocompleteItem } from '../types/superImposeTypes';

const DROPDOWN_MIN_WIDTH = 420;
const DROPDOWN_MAX_HEIGHT = 320;

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

export type SuperImposeLinkedInFacetAutocompleteProps = {
  kind: 'company' | 'location';
  label: string;
  placeholder?: string;
  value: SuperImposeAutocompleteItem | null;
  onChange: (value: SuperImposeAutocompleteItem | null) => void;
  accessToken: string;
  serverBaseUrl: string;
  disabled?: boolean;
};

const StyledWrapper = styled.div`
  position: relative;
  width: 100%;
`;

const StyledInput = styled.input`
  width: 100%;
  padding: ${themeCssVariables.spacing[1.5]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};

  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const StyledDropdown = styled.ul<{ $top: number; $left: number; $width: number }>`
  position: fixed;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: ${({ $width }) => $width}px;
  min-width: ${DROPDOWN_MIN_WIDTH}px;
  max-width: calc(100vw - 16px);
  max-height: ${DROPDOWN_MAX_HEIGHT}px;
  overflow-y: auto;
  margin: 0;
  padding: ${themeCssVariables.spacing[1]};
  list-style: none;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  z-index: 10000;
`;

const StyledDropdownItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1.5]} ${themeCssVariables.spacing[2]};
  cursor: pointer;
  border-radius: ${themeCssVariables.border.radius.sm};

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledLogo = styled.img`
  width: 32px;
  height: 32px;
  border-radius: ${themeCssVariables.border.radius.sm};
  object-fit: cover;
  flex-shrink: 0;
  background: ${themeCssVariables.background.tertiary};
`;

const StyledLogoPlaceholder = styled.div`
  width: 32px;
  height: 32px;
  border-radius: ${themeCssVariables.border.radius.sm};
  flex-shrink: 0;
  background: ${themeCssVariables.background.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
`;

const StyledItemText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledItemTitle = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledItemSubtitle = styled.div`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledSelectedRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledClearButton = styled.button`
  margin-left: auto;
  border: none;
  background: transparent;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledHint = styled.div`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
  padding: ${themeCssVariables.spacing[1.5]};
`;

export const SuperImposeLinkedInFacetAutocomplete = ({
  kind,
  label,
  placeholder,
  value,
  onChange,
  accessToken,
  serverBaseUrl,
  disabled = false,
}: SuperImposeLinkedInFacetAutocompleteProps) => {
  const [inputValue, setInputValue] = useState('');
  const [items, setItems] = useState<SuperImposeAutocompleteItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
    if (!wrapper) {
      return;
    }
    const rect = wrapper.getBoundingClientRect();
    const width = Math.min(
      Math.max(rect.width, DROPDOWN_MIN_WIDTH),
      window.innerWidth - 16,
    );
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - width - 8),
    );
    setDropdownPosition({ top: rect.bottom + 6, left, width });
  }, []);

  const fetchItems = useCallback(
    async (keywords: string) => {
      const trimmed = keywords.trim();
      if (!trimmed) {
        setItems([]);
        return;
      }
      setIsLoading(true);
      try {
        const base = serverBaseUrl.replace(/\/$/, '');
        const path =
          kind === 'company'
            ? '/org-chart/super-impose/autocomplete/company'
            : '/org-chart/super-impose/autocomplete/location';
        const params = new URLSearchParams({
          keywords: trimmed,
          limit: '10',
        });
        const res = await fetch(`${base}${path}?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = (await res.json()) as {
          items?: SuperImposeAutocompleteItem[];
        };
        setItems(Array.isArray(json.items) ? json.items : []);
      } catch {
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, kind, serverBaseUrl],
  );

  const debouncedFetch = useDebouncedCallback(fetchItems, 300);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    updateDropdownPosition();
    const onLayout = () => updateDropdownPosition();
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !wrapperRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const handleSelect = (item: SuperImposeAutocompleteItem) => {
    onChange(item);
    setInputValue('');
    setIsOpen(false);
    setItems([]);
  };

  const subtitleForItem = (item: SuperImposeAutocompleteItem): string | undefined => {
    if (kind === 'location') {
      return undefined;
    }
    const parts = [item.industry, item.locationLabel, item.headcount]
      .filter((part) => typeof part === 'string' && part.trim().length > 0)
      .map((part) => String(part).trim());
    return parts.length > 0 ? parts.join(' · ') : undefined;
  };

  const showDropdown = isOpen && inputValue.trim().length > 0;

  const dropdown = showDropdown
    ? createPortal(
        <StyledDropdown
          ref={dropdownRef}
          $top={dropdownPosition.top}
          $left={dropdownPosition.left}
          $width={dropdownPosition.width}
          onMouseDown={(event) => event.preventDefault()}
        >
          {isLoading ? (
            <StyledHint>Searching…</StyledHint>
          ) : items.length === 0 ? (
            <StyledHint>No results</StyledHint>
          ) : (
            items.map((item) => (
              <StyledDropdownItem
                key={`${kind}-${item.id}`}
                onClick={() => handleSelect(item)}
              >
                {item.pictureUrl ? (
                  <StyledLogo src={item.pictureUrl} alt="" />
                ) : (
                  <StyledLogoPlaceholder>
                    {item.title.charAt(0).toUpperCase()}
                  </StyledLogoPlaceholder>
                )}
                <StyledItemText>
                  <StyledItemTitle>{item.title}</StyledItemTitle>
                  {subtitleForItem(item) ? (
                    <StyledItemSubtitle>{subtitleForItem(item)}</StyledItemSubtitle>
                  ) : null}
                </StyledItemText>
              </StyledDropdownItem>
            ))
          )}
        </StyledDropdown>,
        document.body,
      )
    : null;

  return (
    <StyledWrapper ref={wrapperRef}>
      <StyledInput
        type="text"
        value={inputValue}
        placeholder={placeholder ?? `Search ${label.toLowerCase()}…`}
        disabled={disabled}
        onChange={(event) => {
          const next = event.target.value;
          setInputValue(next);
          setIsOpen(true);
          if (next.trim()) {
            setIsLoading(true);
          }
          debouncedFetch(next);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {value ? (
        <StyledSelectedRow>
          {value.pictureUrl ? (
            <StyledLogo src={value.pictureUrl} alt="" />
          ) : (
            <StyledLogoPlaceholder>
              {value.title.charAt(0).toUpperCase()}
            </StyledLogoPlaceholder>
          )}
          <StyledItemText>
            <StyledItemTitle>{value.title}</StyledItemTitle>
            {subtitleForItem(value) ? (
              <StyledItemSubtitle>{subtitleForItem(value)}</StyledItemSubtitle>
            ) : null}
          </StyledItemText>
          <StyledClearButton
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Clear ${label}`}
          >
            ×
          </StyledClearButton>
        </StyledSelectedRow>
      ) : null}
      {dropdown}
    </StyledWrapper>
  );
};
