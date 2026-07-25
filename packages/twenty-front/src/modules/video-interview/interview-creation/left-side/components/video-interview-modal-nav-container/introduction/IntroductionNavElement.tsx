
import { useQuestionToDisplay } from '@/video-interview/interview-creation/hooks/useQuestionToDisplay';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledIntroductionNavElement = styled.div`
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 6px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  &.active {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  color: ${themeCssVariables.grayScale.gray5};
  border-radius: 4px;
  width: 200px;
  cursor: pointer;
`;

export const IntroductionNavElement = ({ id }: { id: string }) => {
  const { questionToDisplay, changeQuestionToDisplay } = useQuestionToDisplay();

  const changeQuestionToDisplayId = () => {
    changeQuestionToDisplay('introduction');
  };

  return (
    <StyledIntroductionNavElement
      onClick={changeQuestionToDisplayId}
      className={questionToDisplay === id ? 'active' : ''}
    >
      Introduction
    </StyledIntroductionNavElement>
  );
};
