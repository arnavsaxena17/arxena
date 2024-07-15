import { useRecoilState } from 'recoil';

import { isAIInterviewModalOpenState } from '@/ai-interview/interview-creation/states/aIInterviewModalState';

export const useInterviewCreationModal = () => {
  const [isAIInterviewModalOpen, setIsAIInterviewModalOpen] = useRecoilState(
    isAIInterviewModalOpenState,
  );

  const openModal = () => {
    setIsAIInterviewModalOpen(true);
  };

  return {
    isAIInterviewModalOpen,
    openModal,
  };
};
