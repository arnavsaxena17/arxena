import { useMemo, useState } from 'react';
import styled from '@emotion/styled';

import { AllowedRetakes } from '@/ai-interview/interview-creation/right-side/components/question/answer-type-selection/AllowedRetakes';
import { SetAnswerTimeLimit } from '@/ai-interview/interview-creation/right-side/components/question/answer-type-selection/SetAnswerTimeLimit';
import { questionOrAnswerOptions } from '@/ai-interview/interview-creation/right-side/components/question/questionOrAnswerOptions';
import { H2Title } from '@/ui/display/typography/components/H2Title';
import { Select, SelectOption } from '@/ui/input/components/Select';

const StyledSelectContainer = styled.div`
  display: flex;
  width: 200px;
  height: min-content;
  flex-direction: column;
`;

const StyledContainer = styled.div`
  display: flex;
  height: min-content;
  flex-direction: column;
`;

const StyledDependentContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  gap: 44px;
  margin-top: 16px;
`;

const StyledHiddenInput = styled.input`
  display: none;
`;

export const AnswerTypeSelect = ({
  id,
  questionNumber,
}: {
  id: string;
  questionNumber: number;
}) => {
  const [selectedAnswerType, setSelectedAnswerType] = useState<string>('VIDEO');

  const onChange = (value: string) => {
    setSelectedAnswerType(value);
  };

  const name = `newAIInterview[${questionNumber}][answerType]`;

  const options: SelectOption<string>[] = useMemo(() => {
    return questionOrAnswerOptions.map<SelectOption<string>>(
      ({ label, value, Icon }) => ({
        label: label,
        value: value,
        Icon: Icon,
      }),
    );
  }, []);

  return (
    <StyledContainer>
      <H2Title title={'Answer'} />
      <StyledSelectContainer>
        <Select
          fullWidth
          dropdownId={id}
          options={options}
          label="Answer Type"
          withSearchInput
          onChange={onChange}
          value={selectedAnswerType}
          emptyOption={undefined}
        />
        <StyledHiddenInput
          name={name}
          value={selectedAnswerType}
          readOnly={true}
        />
      </StyledSelectContainer>
      {selectedAnswerType === 'VIDEO' ? (
        <StyledDependentContainer>
          <AllowedRetakes questionNumber={questionNumber} />
          <SetAnswerTimeLimit questionNumber={questionNumber} />
        </StyledDependentContainer>
      ) : (
        <></>
      )}
    </StyledContainer>
  );
};
