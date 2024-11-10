import { useRecoilState } from 'recoil';

import { isAIInterviewModalOpenState } from '@/arx-enrich/states/aIInterviewModalState';

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
