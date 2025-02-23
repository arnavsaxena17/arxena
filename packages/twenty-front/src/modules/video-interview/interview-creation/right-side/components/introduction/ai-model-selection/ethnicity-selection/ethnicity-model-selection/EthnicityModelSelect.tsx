import { useMemo, useState } from 'react';
import styled from '@emotion/styled';

import { Country } from '@/ui/input/components/internal/types/Country';
import { Select, SelectOption } from '@/ui/input/components/Select';

import { SELECT_ETHNICITY_MODEL_DROPDOWN_ID } from './selectEthnicityModelDropdownId';

const StyledHiddenInput = styled.input`
  display: none;
`;

export const EthnicityModelSelect = ({ selectedLanguage, videoInterviewModelsArr, selectedCountry }: { selectedLanguage: string | undefined; videoInterviewModelsArr: any; selectedCountry: Country | undefined }) => {
  const [selectedModel, setSelectedModel] = useState<string>('Select Model');

  type model = {
    id: 'string';
    name: 'string';
  };

  const availableModels: model[] = useMemo(() => {
    const availableModelsArr: any = [];

    for (let i = 0; i < videoInterviewModelsArr.length; i++) {
      if (videoInterviewModelsArr[i].node.country === selectedCountry?.countryCode && videoInterviewModelsArr[i].node.language === selectedLanguage) {
        const videoInterviewModel = {
          id: videoInterviewModelsArr[i].node.id,
          name: videoInterviewModelsArr[i].node.name,
        };
        availableModelsArr.push(videoInterviewModel);
      }
    }

    return availableModelsArr;
  }, [selectedCountry, selectedLanguage, videoInterviewModelsArr]);

  const onChange = (id: string) => {
    setSelectedModel(id);
  };

  const options: SelectOption<string>[] = useMemo(() => {
    return availableModels.map<SelectOption<string>>(model => ({
      label: model.name,
      value: model.id,
    }));
  }, [availableModels]);

  const name = `newVideoInterviewTemplate[${0}][videoInterviewModelId]`;

  return (
    <>
      <Select fullWidth dropdownId={SELECT_ETHNICITY_MODEL_DROPDOWN_ID} options={options} label="Model" withSearchInput onChange={onChange} value={selectedModel} emptyOption={undefined} />
      <StyledHiddenInput name={name} value={selectedModel} readOnly={true} />
    </>
  );
};
