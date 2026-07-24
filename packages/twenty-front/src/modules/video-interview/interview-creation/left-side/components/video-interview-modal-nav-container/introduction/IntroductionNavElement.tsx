import styled from '@emotion/styled';

import { useQuestionToDisplay } from '@/video-interview/interview-creation/hooks/useQuestionToDisplay';

const StyledIntroductionNavElement = styled.div`
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: 6px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
  &.active {
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
  color: ${({ theme }) => theme.grayScale.gray50};
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
