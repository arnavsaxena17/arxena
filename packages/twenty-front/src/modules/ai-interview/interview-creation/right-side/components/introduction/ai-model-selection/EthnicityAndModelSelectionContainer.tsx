import { useMemo, useState } from 'react';
import styled from '@emotion/styled';

import { EthnicityCountryPickerDropdownButton } from '@/ai-interview/interview-creation/right-side/components/introduction/ai-model-selection/ethnicity-selection/ethnicity-country-selection/EthnicityCountryPickerDropdownButton';
import { EthnicityLanguageSelect } from '@/ai-interview/interview-creation/right-side/components/introduction/ai-model-selection/ethnicity-selection/ethnicity-language-selection/EthnicityLanguageSelect';
import { EthnicityModelSelect } from '@/ai-interview/interview-creation/right-side/components/introduction/ai-model-selection/ethnicity-selection/ethnicity-model-selection/EthnicityModelSelect';
import { H2Title } from '@/ui/display/typography/components/H2Title';
import { useCountries } from '@/ui/input/components/internal/hooks/useCountries';
import { Country } from '@/ui/input/components/internal/types/Country';
import { isDefined } from '~/utils/isDefined';

const StyledEthnicitySelectionContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledDropdownsContianer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 200px;
`;

const StyledLabel = styled.span`
  color: ${({ theme }) => theme.font.color.light};
  display: block;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledEthnicityContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StyledEthnicityDropdownsContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 4px;
`;

export const EthnicityAndModelSelectionContainer = ({
  aIModelsArr,
}: {
  aIModelsArr: any;
}) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>();
  const countriesArr = useCountries();
  const [selectedLanguage, setSelectedLanguage] =
    useState<string>('Select Language');

  const availableLanguages: string[] = useMemo(() => {
    const availableLanguagesArr: any = [];

    for (let i = 0; i < aIModelsArr.length; i++) {
      if (aIModelsArr[i].node.country === selectedCountry?.countryCode) {
        availableLanguagesArr.push(aIModelsArr[i].node.language);
      }
    }

    const languagesArr: string[] = [];

    for (let i = 0; i < availableLanguagesArr.length; i++) {
      if (
        languagesArr.find((e: string) => e === availableLanguagesArr[i]) ===
        undefined
      ) {
        languagesArr.push(availableLanguagesArr[i]);
      }
    }

    return languagesArr;
  }, [selectedCountry, aIModelsArr]);

  const aIModelsCountriesArr: string[] = aIModelsArr.map((e: any) => {
    return e.node.country;
  });

  const aIModelsCountries: string[] = [];

  for (let i = 0; i < aIModelsCountriesArr.length; i++) {
    if (
      aIModelsCountries.find((e) => e === aIModelsCountriesArr[i]) === undefined
    ) {
      aIModelsCountries.push(aIModelsCountriesArr[i]);
    }
  }

  const countries: Country[] = [];

  for (let i = 0; i < aIModelsCountries.length; i++) {
    const country = countriesArr.find(
      (e) => e.countryCode === aIModelsCountries[i],
    );
    if (country !== undefined) {
      countries.push(country);
    }
  }

  const handleCountryChange = (code: string) => {
    const country = countries.find(({ countryCode }) => countryCode === code);
    if (isDefined(country)) {
      setSelectedCountry(country);
    }
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  return (
    <StyledEthnicitySelectionContainer>
      <H2Title title="AI Model" />
      <StyledDropdownsContianer>
        <StyledEthnicityContainer>
          <StyledLabel>{'Ethnicity'}</StyledLabel>
          <StyledEthnicityDropdownsContainer>
            <EthnicityCountryPickerDropdownButton
              countries={countries}
              selectedCountry={selectedCountry}
              onChange={handleCountryChange}
            />
            <EthnicityLanguageSelect
              selectedLanguage={selectedLanguage}
              availableLanguages={availableLanguages}
              onChange={handleLanguageChange}
            />
          </StyledEthnicityDropdownsContainer>
        </StyledEthnicityContainer>
        <EthnicityModelSelect
          aIModelsArr={aIModelsArr}
          selectedLanguage={selectedLanguage}
          selectedCountry={selectedCountry}
        />
      </StyledDropdownsContianer>
    </StyledEthnicitySelectionContainer>
  );
};
