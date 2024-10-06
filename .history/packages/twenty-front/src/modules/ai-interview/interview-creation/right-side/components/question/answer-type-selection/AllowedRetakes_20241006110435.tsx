import styled from '@emotion/styled';

import { Select, SelectOption } from '@/ui/input/components/Select';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 200px;
`;

export const AllowedRetakes = ({ questionNumber }: { questionNumber: number }) => {
  const name = `newAIInterview[${questionNumber}][retakes]`;

  return (
    <StyledContainer>
      <Select fullWidth dropdownId={ALLOWED_RETALKES} options={options} label="Model" withSearchInput onChange={onChange} value={selectedModel} emptyOption={undefined} />
    </StyledContainer>
  );
};
