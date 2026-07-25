
import { TextInput } from '@/ui/input/components/TextInput';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 200px;
`;

export const AllowedRetakes = ({ questionNumber }: { questionNumber: number }) => {
  const name = `newVideoInterviewTemplate[${questionNumber}][retakes]`;

  return (
    <StyledContainer>
      <TextInput label="Retakes Allowed" placeholder="Max 2" type="number" min={0} max={2} step={1} required name={name} />
    </StyledContainer>
  );
};
