import styled from '@emotion/styled';
import { useMemo, useState } from 'react';

import { useCountries } from '@/ui/input/components/internal/hooks/useCountries';
import { Country } from '@/ui/input/components/internal/types/Country';
import { EthnicityCountryPickerDropdownButton } from '@/video-interview/interview-creation/right-side/components/introduction/ai-model-selection/ethnicity-selection/ethnicity-country-selection/EthnicityCountryPickerDropdownButton';
import { EthnicityLanguageSelect } from '@/video-interview/interview-creation/right-side/components/introduction/ai-model-selection/ethnicity-selection/ethnicity-language-selection/EthnicityLanguageSelect';
import { EthnicityModelSelect } from '@/video-interview/interview-creation/right-side/components/introduction/ai-model-selection/ethnicity-selection/ethnicity-model-selection/EthnicityModelSelect';
import { H2Title } from 'twenty-ui';

import { isDefined } from 'twenty-shared';

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

export const EthnicityAndModelSelectionContainer = ({ videoInterviewModelsArr }: { videoInterviewModelsArr: any }) => {
  // const [selectedCountry, setSelectedCountry] = useState<Country>();
  const countriesArr = useCountries();
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Select Language');

  const videoInterviewModelsCountriesArr: string[] = videoInterviewModelsArr.map((e: any) => {
    return e.node.country;
  });

  const videoInterviewModelsCountries: string[] = [];

  for (let i = 0; i < videoInterviewModelsCountriesArr.length; i++) {
    if (videoInterviewModelsCountries.find(e => e === videoInterviewModelsCountriesArr[i]) === undefined) {
      videoInterviewModelsCountries.push(videoInterviewModelsCountriesArr[i]);
    }
  }

  const countries: Country[] = [];

  for (let i = 0; i < videoInterviewModelsCountries.length; i++) {
    const country = countriesArr.find(e => e.countryCode === videoInterviewModelsCountries[i]);
    if (country !== undefined) {
      countries.push(country);
    }
  }

  const [selectedCountry, setSelectedCountry] = useState<Country | undefined>(
    countries.length > 0 ? countries[0] : undefined
  );
  

  const handleCountryChange = (code: string) => {
    const country = countries.find(({ countryCode }) => countryCode === code);
    if (isDefined(country)) {
      setSelectedCountry(country);
    }
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };



  const availableLanguages: string[] = useMemo(() => {
    const availableLanguagesArr: any = [];

    for (let i = 0; i < videoInterviewModelsArr.length; i++) {
      console.log("videoInterviewModelsArr[i].node.country::", videoInterviewModelsArr[i].node.country)
      console.log("selectedCountry?.countryCode::", selectedCountry?.countryCode)
      if (videoInterviewModelsArr[i].node.country === selectedCountry?.countryCode) {
        availableLanguagesArr.push(videoInterviewModelsArr[i].node.language);
      }
    }
    console.log("Setting the value of availableLanguagesArr to::", availableLanguagesArr)

    const languagesArr: string[] = [];

    for (let i = 0; i < availableLanguagesArr.length; i++) {
      if (languagesArr.find((e: string) => e === availableLanguagesArr[i]) === undefined) {
        languagesArr.push(availableLanguagesArr[i]);
      }
    }

    return languagesArr;
  }, [selectedCountry, videoInterviewModelsArr]);

  console.log("countries::", countries)
  console.log("selectedCountry::", selectedCountry)
  console.log("availableLanguages::", availableLanguages)
  console.log("selectedLanguage::", selectedLanguage)
  console.log("videoInterviewModelsArr::", videoInterviewModelsArr)
  
  return (
    <StyledEthnicitySelectionContainer>
      <H2Title title="Video Interview Model" />
      <StyledDropdownsContianer>
        <StyledEthnicityContainer>
          <StyledLabel>{'Ethnicity'}</StyledLabel>
          <StyledEthnicityDropdownsContainer>
            <EthnicityCountryPickerDropdownButton countries={countries} selectedCountry={selectedCountry} onChange={handleCountryChange} />
            <EthnicityLanguageSelect selectedLanguage={selectedLanguage} availableLanguages={availableLanguages} onChange={handleLanguageChange} />
          </StyledEthnicityDropdownsContainer>
        </StyledEthnicityContainer>
        <EthnicityModelSelect videoInterviewModelsArr={videoInterviewModelsArr} selectedLanguage={selectedLanguage} selectedCountry={selectedCountry} />
      </StyledDropdownsContianer>
    </StyledEthnicitySelectionContainer>
  );
};