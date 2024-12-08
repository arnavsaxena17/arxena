import { useRecoilState } from 'recoil';

import { isArxEnrichModalOpenState } from '@/arx-enrich/states/arxEnrichModalOpenState';

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