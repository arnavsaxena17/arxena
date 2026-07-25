import { IconChevronDown, IconWorld } from 'twenty-ui/icon';
import { styled } from '@linaria/react';
import { themeCssVariables, useTheme } from 'twenty-ui/theme-constants';

import { Country } from '@/ui/input/components/internal/types/Country';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { isDropdownOpenComponentState } from '@/ui/layout/dropdown/states/isDropdownOpenComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';

import { ETHNICITY_COUNTRY_PICKER_DROPDOWN_ID } from './ethnicityCountryPickerDropdownId';
import { EthnicityCountryPickerDropdownSelect } from './EthnicityCountryPickerDropdownSelect';

type StyledDropdownButtonProps = {
  isUnfolded: boolean;
};

export const StyledDropdownButtonContainer = styled.div<StyledDropdownButtonProps>`
  align-items: center;
  background-color: ${themeCssVariables.background.transparent.lighter};
  color: ${({ color }) => color ?? 'none'};
  cursor: pointer;
  display: flex;
  width: min-content;
  height: 32px;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding-left: ${themeCssVariables.spacing[2]};
  padding-right: ${themeCssVariables.spacing[2]};

  user-select: none;

  border-right: 1px solid ${themeCssVariables.border.color.light};

  &:hover {
    filter: brightness(0.95);
  }
`;

const StyledIconContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
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
  const isDropdownOpen = useAtomComponentStateValue(
    isDropdownOpenComponentState,
    ETHNICITY_COUNTRY_PICKER_DROPDOWN_ID,
  );
  const { closeDropdown } = useCloseDropdown();

  const handleChange = (code: string) => {
    closeDropdown(ETHNICITY_COUNTRY_PICKER_DROPDOWN_ID);
    onChange(code);
  };

  console.log("countries::", countries)
  console.log("selectedCountry::", selectedCountry)

  return (
    <Dropdown
      dropdownId={ETHNICITY_COUNTRY_PICKER_DROPDOWN_ID}
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