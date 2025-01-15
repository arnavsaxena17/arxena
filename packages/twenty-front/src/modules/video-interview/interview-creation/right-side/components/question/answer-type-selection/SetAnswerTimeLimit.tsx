import styled from '@emotion/styled';

import { H2Title } from '@/ui/display/typography/components/H2Title';
import { TextInput } from '@/ui/input/components/TextInput';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

const StyledLimitInputsContainer = styled.div`
  display: flex;
  flex-direction: row;
  gap: 16px;
`;

export const SetAnswerTimeLimit = ({
  questionNumber,
}: {
  questionNumber: number;
}) => {
  const nameMinutes = `newVideoInterviewTemplate[${questionNumber}][timeLimit]`;

  return (
    <StyledContainer>
      <H2Title title={'Set Time Limit'} />
      <StyledLimitInputsContainer>
        <TextInput
          label="Minutes"
          placeholder="Between 0 - 60"
          type="number"
          min={0}
          max={60}
          step={1}
          width={'200px'}
          required
          name={nameMinutes}
        />
        {/* <TextInput
          label="Seconds"
          placeholder="Between 0 - 60"
          type="number"
          min={0}
          max={60}
          step={1}
          width={'200px'}
          required
          name={nameSeconds}
        /> */}
      </StyledLimitInputsContainer>
    </StyledContainer>
  );
};
