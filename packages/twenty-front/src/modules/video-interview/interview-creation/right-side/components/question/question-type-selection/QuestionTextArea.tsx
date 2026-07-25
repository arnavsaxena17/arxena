import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  margin-top: 16px;
`;

const StyledTextArea = styled.textarea`
  background-color: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.regular};
  line-height: 16px;
  overflow: auto;
  padding: ${themeCssVariables.spacing[2]};
  padding-top: ${themeCssVariables.spacing[3]};
  resize: none;
  width: 100%;
  height: min-content;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
    font-weight: ${themeCssVariables.font.weight.regular};
    font-size: ${themeCssVariables.font.size.md};
  }

  &:disabled {
    color: ${themeCssVariables.font.color.tertiary};
  }
`;

export const QuestionTextArea = ({
  questionNumber,
}: {
  questionNumber: number;
}) => {
  const name = `newVideoInterviewTemplate[${questionNumber}][question]`;

  return (
    <StyledContainer>
      <StyledTextArea
        placeholder={'Type Question Here...'}
        rows={4}
        name={name}
      />
    </StyledContainer>
  );
};
