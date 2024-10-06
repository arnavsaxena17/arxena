import { useMemo, useRef, useState } from 'react';
import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { IconChevronDown, IconComponent } from 'twenty-ui';

import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSearchInput } from '@/ui/layout/dropdown/components/DropdownMenuSearchInput';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';
import { MenuItem } from '@/ui/navigation/menu-item/components/MenuItem';

import { SelectHotkeyScope } from '../types/SelectHotkeyScope';

export type SelectOption<Value extends string | number | null> = {
  value: Value;
  label: string;
  Icon?: IconComponent;
};

export type SelectProps<Value extends string | number | null> = {
  className?: string;
  disabled?: boolean;
  disableBlur?: boolean;
  dropdownId: string;
  dropdownWidth?: `${string}px` | 'auto' | number;
  emptyOption?: SelectOption<Value>;
  fullWidth?: boolean;
  label?: string;
  onChange?: (value: Value) => void;
  onBlur?: () => void;
  options: SelectOption<Value>[];
  value?: Value;
  withSearchInput?: boolean;
};

const StyledContainer = styled.div<{ fullWidth?: boolean }>`
  width: ${({ fullWidth }) => (fullWidth ? '100%' : 'auto')};
`;

const StyledControlContainer = styled.div<{ disabled?: boolean }>`
  align-items: center;
  background-color: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  box-sizing: border-box;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ disabled, theme }) => (disabled ? theme.font.color.tertiary : theme.font.color.primary)};
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  height: ${({ theme }) => theme.spacing(8)};
  justify-content: space-between;
  padding: 0 ${({ theme }) => theme.spacing(2)};
`;

const StyledLabel = styled.span`
  color: ${({ theme }) => theme.font.color.light};
  display: block;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledControlLabel = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledIconChevronDown = styled(IconChevronDown)<{ disabled?: boolean }>`
<<<<<<< HEAD
  color: ${({ disabled, theme }) =>
    disabled ? theme.font.color.extraLight : theme.font.color.tertiary};
=======
  color: ${({ disabled, theme }) => (disabled ? theme.font.color.extraLight : theme.font.color.tertiary)};
>>>>>>> f1b1a1a513bb5002db9aa29394eaf568639c18b4
`;

export const Select = <Value extends string | number | null>({
  className,
  disabled: disabledFromProps,
  disableBlur = false,
  dropdownId,
  dropdownWidth = 176,
  emptyOption,
  fullWidth,
  label,
  onChange,
  onBlur,
  options,
  value,
  withSearchInput,
}: SelectProps<Value>) => {
  const selectContainerRef = useRef<HTMLDivElement>(null);

  const theme = useTheme();
  const [searchInputValue, setSearchInputValue] = useState('');

<<<<<<< HEAD
  const selectedOption =
    options.find(({ value: key }) => key === value) ||
    options[0] ||
    emptyOption;
  const filteredOptions = useMemo(
    () =>
      searchInputValue
        ? options.filter(({ label }) =>
            label.toLowerCase().includes(searchInputValue.toLowerCase()),
          )
        : options,
    [options, searchInputValue],
  );

  const isDisabled = disabledFromProps || options.length <= 1;
=======
  const selectedOption = options.find(({ value: key }) => key === value) || emptyOption;
  const filteredOptions = useMemo(() => (searchInputValue ? options.filter(({ label }) => label.toLowerCase().includes(searchInputValue.toLowerCase())) : options), [options, searchInputValue]);

  const isDisabled = disabledFromProps || options.length <= 0;
>>>>>>> f1b1a1a513bb5002db9aa29394eaf568639c18b4

  const { closeDropdown } = useDropdown(dropdownId);

  const selectControl = (
    <StyledControlContainer disabled={isDisabled}>
      <StyledControlLabel>
<<<<<<< HEAD
        {!!selectedOption?.Icon && (
          <selectedOption.Icon
            color={
              isDisabled ? theme.font.color.light : theme.font.color.primary
            }
            size={theme.icon.size.md}
            stroke={theme.icon.stroke.sm}
          />
        )}
=======
        {!!selectedOption?.Icon && <selectedOption.Icon color={isDisabled ? theme.font.color.light : theme.font.color.primary} size={theme.icon.size.md} stroke={theme.icon.stroke.sm} />}
>>>>>>> f1b1a1a513bb5002db9aa29394eaf568639c18b4
        {selectedOption?.label}
      </StyledControlLabel>
      <StyledIconChevronDown disabled={isDisabled} size={theme.icon.size.md} />
    </StyledControlContainer>
  );

  return (
<<<<<<< HEAD
    <StyledContainer
      className={className}
      fullWidth={fullWidth}
      tabIndex={0}
      onBlur={onBlur}
      ref={selectContainerRef}
    >
=======
    <StyledContainer className={className} fullWidth={fullWidth} tabIndex={0} onBlur={onBlur} ref={selectContainerRef}>
>>>>>>> f1b1a1a513bb5002db9aa29394eaf568639c18b4
      {!!label && <StyledLabel>{label}</StyledLabel>}
      {isDisabled ? (
        selectControl
      ) : (
        <Dropdown
          dropdownId={dropdownId}
          dropdownMenuWidth={dropdownWidth}
          dropdownPlacement="bottom-start"
          clickableComponent={selectControl}
          disableBlur={disableBlur}
          dropdownComponents={
            <>
<<<<<<< HEAD
              {!!withSearchInput && (
                <DropdownMenuSearchInput
                  autoFocus
                  value={searchInputValue}
                  onChange={(event) => setSearchInputValue(event.target.value)}
                />
              )}
              {!!withSearchInput && !!filteredOptions.length && (
                <DropdownMenuSeparator />
              )}
              {!!filteredOptions.length && (
                <DropdownMenuItemsContainer hasMaxHeight>
                  {filteredOptions.map((option) => (
=======
              {!!withSearchInput && <DropdownMenuSearchInput autoFocus value={searchInputValue} onChange={event => setSearchInputValue(event.target.value)} />}
              {!!withSearchInput && !!filteredOptions.length && <DropdownMenuSeparator />}
              {!!filteredOptions.length && (
                <DropdownMenuItemsContainer hasMaxHeight>
                  {filteredOptions.map(option => (
>>>>>>> f1b1a1a513bb5002db9aa29394eaf568639c18b4
                    <MenuItem
                      key={option.value}
                      LeftIcon={option.Icon}
                      text={option.label}
                      onClick={() => {
                        onChange?.(option.value);
                        onBlur?.();
                        closeDropdown();
                      }}
                    />
                  ))}
                </DropdownMenuItemsContainer>
              )}
            </>
          }
          dropdownHotkeyScope={{ scope: SelectHotkeyScope.Select }}
        />
      )}
    </StyledContainer>
  );
};
