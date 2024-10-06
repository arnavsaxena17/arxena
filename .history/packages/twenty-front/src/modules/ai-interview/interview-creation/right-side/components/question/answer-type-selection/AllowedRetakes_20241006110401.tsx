import styled from '@emotion/styled';

import { TextInput } from '@/ui/input/components/TextInput';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 200px;
`;

export const AllowedRetakes = ({ questionNumber }: { questionNumber: number }) => {
  const name = `newAIInterview[${questionNumber}][retakes]`;

  return (
    <StyledContainer>
      <Select fullWidth dropdownId={SELECT_ETHNICITY_MODEL_DROPDOWN_ID} options={options} label="Model" withSearchInput onChange={onChange} value={selectedModel} emptyOption={undefined} />
    </StyledContainer>
  );
};
