import { useMemo, useState } from 'react';
import styled from '@emotion/styled';

import { questionOrAnswerOptions } from '@/ai-interview/interview-creation/right-side/components/question/questionOrAnswerOptions';
import { Select, SelectOption } from '@/ui/input/components/Select';

const StyledContainer = styled.div`
  display: flex;
  width: 200px;
  height: min-content;
  flex-direction: column;
`;

const StyledHiddenInput = styled.input`
  display: none;
`;

export const QuestionTypeSelect = ({
  id,
  questionNumber,
}: {
  id: string;
  questionNumber: number;
}) => {
  const [selectedQuestionType, setSelectedQuestionType] =
    useState<string>('VIDEO');

  const onChange = (value: string) => {
    setSelectedQuestionType(value);
  };

  const options: SelectOption<string>[] = useMemo(() => {
    return questionOrAnswerOptions.map<SelectOption<string>>(
      ({ label, value, Icon }) => ({
        label: label,
        value: value,
        Icon: Icon,
      }),
    );
  }, []);

  const name = `newAIInterview[${questionNumber}][questionType]`;

  return (
    <StyledContainer>
      <Select
        fullWidth
        dropdownId={id}
        options={options}
        label="Question Type"
        withSearchInput
        onChange={onChange}
        value={selectedQuestionType}
        emptyOption={undefined}
      />
      <StyledHiddenInput
        name={name}
        value={selectedQuestionType}
        readOnly={true}
      />
    </StyledContainer>
  );
};
