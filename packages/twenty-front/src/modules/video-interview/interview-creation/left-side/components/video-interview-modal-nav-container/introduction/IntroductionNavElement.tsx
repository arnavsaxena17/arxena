
import { useQuestionToDisplay } from '@/video-interview/interview-creation/hooks/useQuestionToDisplay';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledIntroductionNavElement = styled.div`
  border-radius: 4px;
  color: ${themeCssVariables.grayScale.gray5};
  cursor: pointer;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};

  &:hover {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  &.active {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 6px;
  transition: background-color 0.2s ease;
  width: 200px;
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
