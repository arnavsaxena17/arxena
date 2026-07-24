import { useMemo } from 'react';

import { Select, SelectOption } from '@/ui/input/components/Select';

import { SELECT_ETHNICITY_LANGUAGE_DROPDOWN_ID } from './selectEthnicityLanguageDropdownId';

export const EthnicityLanguageSelect = ({
  selectedLanguage,
  availableLanguages,
  onChange,
}: {
  selectedLanguage: string | undefined;
  availableLanguages: string[];
  onChange: (language: string) => void;
}) => {
  const handleChange = (language: string) => {
    onChange(language);
  };

  const options: SelectOption<string>[] = useMemo(() => {
    return availableLanguages.map<SelectOption<string>>((language) => ({
      label: language,
      value: language,
    }));
  }, [availableLanguages]);

  return (
    <Select
      fullWidth
      dropdownId={SELECT_ETHNICITY_LANGUAGE_DROPDOWN_ID}
      options={options}
      withSearchInput
      onChange={handleChange}
      value={selectedLanguage}
      emptyOption={undefined}
    />
  );
};
