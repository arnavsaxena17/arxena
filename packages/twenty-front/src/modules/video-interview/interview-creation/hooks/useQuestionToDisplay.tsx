import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

import { questionToDisplayState } from '@/video-interview/interview-creation/states/questionToDisplay';

export const useQuestionToDisplay = () => {
  const [questionToDisplay, setQuestionToDisplay] = useAtomState(
    questionToDisplayState,
  );
  const changeQuestionToDisplay = (id: string) => {
    setQuestionToDisplay(id);
  };

  return { questionToDisplay, changeQuestionToDisplay };
};
