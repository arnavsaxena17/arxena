import { useRecoilState } from 'recoil';

import { isArxEnrichModalOpenState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';

export const useArxEnrichCreationModal = () => {
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useRecoilState(
    isArxEnrichModalOpenState,
  );

  const openModal = () => {
    setIsArxEnrichModalOpen(true);
  };

  return {
    isArxEnrichModalOpen,
    openModal,
  };
};