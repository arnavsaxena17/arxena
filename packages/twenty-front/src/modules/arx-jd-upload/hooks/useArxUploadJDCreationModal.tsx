import { useRecoilState } from 'recoil';

import { isArxEnrichModalOpenState } from '@/arx-jd-upload/states/arxEnrichModalOpenState';

export const useArxUploadJDCreationModal = () => {
  const [isArxEnrichModalOpen, setIsArxEnrichModalOpen] = useRecoilState(
    isArxEnrichModalOpenState,
  );

  const openJDCreationModal = () => {
    setIsArxEnrichModalOpen(true);
  };

  return {
    isArxEnrichModalOpen,
    openJDCreationModal,
  };
};