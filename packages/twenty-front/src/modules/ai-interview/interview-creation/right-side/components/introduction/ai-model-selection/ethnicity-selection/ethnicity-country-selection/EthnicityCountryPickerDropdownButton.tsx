import { useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { IconChevronDown, IconWorld } from 'twenty-ui';

import { CountryPickerHotkeyScope } from '@/ui/input/components/internal/phone/types/CountryPickerHotkeyScope';
import { Country } from '@/ui/input/components/internal/types/Country';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { useDropdown } from '@/ui/layout/dropdown/hooks/useDropdown';

import { EthnicityCountryPickerDropdownSelect } from './EthnicityCountryPickerDropdownSelect';

type StyledDropdownButtonProps = {
  isUnfolded: boolean;
};

export const StyledDropdownButtonContainer = styled.div<StyledDropdownButtonProps>`
  align-items: center;
  background-color: ${({ theme }) => theme.background.transparent.lighter};
  color: ${({ color }) => color ?? 'none'};
  cursor: pointer;
  display: flex;
  width: min-content;
  height: 32px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding-left: ${({ theme }) => theme.spacing(2)};
  padding-right: ${({ theme }) => theme.spacing(2)};

  user-select: none;

  border-right: 1px solid ${({ theme }) => theme.border.color.light};

  &:hover {
    filter: brightness(0.95);
  }
`;

const StyledIconContainer = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.tertiary};
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  justify-content: center;

  svg {
    align-items: center;
    display: flex;
    height: 12px;
    justify-content: center;
  }
`;

export const EthnicityCountryPickerDropdownButton = ({
  countries,
  selectedCountry,
  onChange,
}: {
  countries: Country[];
  selectedCountry: Country | undefined;
  onChange: (countryCode: string) => void;
}) => {
  const theme = useTheme();

  const { isDropdownOpen, closeDropdown } = useDropdown(
    'ethnicity-country-picker',
  );

  const handleChange = (code: string) => {
    closeDropdown();
    onChange(code);
  };

  return (
    <Dropdown
      dropdownMenuWidth={200}
      dropdownId="ethnicity-country-picker-dropdown-id"
      dropdownHotkeyScope={{ scope: CountryPickerHotkeyScope.CountryPicker }}
      clickableComponent={
        <StyledDropdownButtonContainer isUnfolded={isDropdownOpen}>
          <StyledIconContainer>
            {selectedCountry ? <selectedCountry.Flag /> : <IconWorld />}
            <IconChevronDown size={theme.icon.size.sm} />
          </StyledIconContainer>
        </StyledDropdownButtonContainer>
      }
      dropdownComponents={
        <EthnicityCountryPickerDropdownSelect
          countries={countries}
          selectedCountry={selectedCountry}
          onChange={handleChange}
        />
      }
      dropdownPlacement="bottom-start"
      dropdownOffset={{ x: 0, y: 4 }}
    />
  );
};
