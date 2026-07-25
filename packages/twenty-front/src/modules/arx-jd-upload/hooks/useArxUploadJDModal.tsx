import { isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';

import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

export const useArxUploadJDModal = () => {
  const [isArxUploadJDModalOpen, setIsArxUploadJDModalOpen] = useAtomState(
    isArxUploadJDModalOpenState,
  );

  const openUploadJDModal = () => {
    setIsArxUploadJDModalOpen(true);
  };

  const closeUploadJDModal = () => {
    setIsArxUploadJDModalOpen(false);
  };

  return {
    isArxUploadJDModalOpen,
    openUploadJDModal,
    closeUploadJDModal,
  };
};
