import {
  arxUploadJDModalModeState,
  isArxUploadJDModalOpenState,
} from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { useCallback } from 'react';

import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

import { useSetParsedJDInternalState } from './useParsedJDState';

export const useOpenAddProjectModal = () => {
  const setParsedJDInternalState = useSetParsedJDInternalState();
  const setArxUploadJDModalMode = useSetAtomState(arxUploadJDModalModeState);
  const setIsArxUploadJDModalOpen = useSetAtomState(
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
