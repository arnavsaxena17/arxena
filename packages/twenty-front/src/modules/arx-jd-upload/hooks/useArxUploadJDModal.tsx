import { isArxUploadJDModalOpenState } from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { useRecoilState } from 'recoil';

export const useArxUploadJDModal = () => {
  const [isArxUploadJDModalOpen, setIsArxUploadJDModalOpen] = useRecoilState(
    isArxUploadJDModalOpenState,
  );

  const openUploadJDModal = () => {
    setIsArxUploadJDModalOpen(true);
  };

  return {
    isArxUploadJDModalOpen,
    openUploadJDModal,
  };
};
