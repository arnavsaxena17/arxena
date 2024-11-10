import { useRecoilState } from 'recoil';

import { questionToDisplayState } from '@/arx-enrich/states/questionToDisplay';

export const useQuestionToDisplay = () => {
  const [questionToDisplay, setQuestionToDisplay] = useRecoilState(
    questionToDisplayState,
  );
  const changeQuestionToDisplay = (id: string) => {
    setQuestionToDisplay(id);
  };

  return { questionToDisplay, changeQuestionToDisplay };
};
