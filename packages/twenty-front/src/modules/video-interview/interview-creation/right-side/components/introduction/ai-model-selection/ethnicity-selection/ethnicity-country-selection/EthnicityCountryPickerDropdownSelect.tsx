import { useMemo, useState } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { Country } from '@/ui/input/components/internal/types/Country';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { DropdownMenuSearchInput } from '@/ui/layout/dropdown/components/DropdownMenuSearchInput';
import { DropdownMenuSeparator } from '@/ui/layout/dropdown/components/DropdownMenuSeparator';
import { MenuItem, MenuItemSelectAvatar } from 'twenty-ui/navigation';

import 'react-phone-number-input/style.css';

const StyledIconContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  padding-right: ${themeCssVariables.spacing[1]};

  svg {
    align-items: center;
    border-radius: ${themeCssVariables.border.radius.xs};
    display: flex;
    height: 12px;
    justify-content: center;
  }
`;

export const EthnicityCountryPickerDropdownSelect = ({
  countries,
  selectedCountry,
  onChange,
}: {
  countries: Country[];
  selectedCountry?: Country;
  onChange: (countryCode: string) => void;
}) => {
  const [searchFilter, setSearchFilter] = useState<string>('');

  const filteredCountries = useMemo(
    () =>
      countries.filter(({ countryName }) =>
        countryName
          .toLocaleLowerCase()
          .includes(searchFilter.toLocaleLowerCase()),
      ),
    [countries, searchFilter],
  );
  console.log("filteredCountries::", filteredCountries)
  console.log("searchFilter::", searchFilter)

  return (
    <DropdownContent>
      <DropdownMenuSearchInput
        value={searchFilter}
        onChange={(event) => setSearchFilter(event.currentTarget.value)}
        autoFocus
      />
      <DropdownMenuSeparator />
      <DropdownMenuItemsContainer hasMaxHeight>
        {filteredCountries?.length === 0 ? (
          <MenuItem text="No result" />
        ) : (
          <>
            {selectedCountry && (
              <MenuItemSelectAvatar
                key={selectedCountry.countryCode}
                selected={true}
                onClick={() => onChange(selectedCountry.countryCode)}
                text={`${selectedCountry.countryName}`}
                avatar={
                  <StyledIconContainer>
                    <selectedCountry.Flag />
                  </StyledIconContainer>
                }
              />
            )}
            {filteredCountries.map(({ countryCode, countryName, Flag }) =>
              selectedCountry?.countryCode === countryCode ? null : (
                <MenuItemSelectAvatar
                  key={countryCode}
                  selected={selectedCountry?.countryCode === countryCode}
                  onClick={() => onChange(countryCode)}
                  text={`${countryName}`}
                  avatar={
                    <StyledIconContainer>
                      <Flag />
                    </StyledIconContainer>
                  }
                />
              ),
            )}
          </>
        )}
      </DropdownMenuItemsContainer>
    </DropdownContent>
  );
};
