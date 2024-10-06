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
      <TextInput label="Retakes Allowed" placeholder="Max 5" type="number" min={0} max={5} step={1} required name={name} />
    </StyledContainer>
  );
};
