import { parsedJDInternalState } from '@/arx-jd-upload/states/arxJDFormStepperState';
import {
  arxUploadJDModalModeState,
  isArxUploadJDModalOpenState,
} from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

export const useOpenAddJobModal = () => {
  const setParsedJDInternalState = useSetRecoilState(parsedJDInternalState);
  const setArxUploadJDModalMode = useSetRecoilState(arxUploadJDModalModeState);
  const setIsArxUploadJDModalOpen = useSetRecoilState(
    isArxUploadJDModalOpenState,
  );

  const openAddJobModal = useCallback(() => {
    setParsedJDInternalState(null);
    setArxUploadJDModalMode('create');
    requestAnimationFrame(() => {
      setIsArxUploadJDModalOpen(true);
    });
  }, [
    setParsedJDInternalState,
    setArxUploadJDModalMode,
    setIsArxUploadJDModalOpen,
  ]);

  return { openAddJobModal };
};
