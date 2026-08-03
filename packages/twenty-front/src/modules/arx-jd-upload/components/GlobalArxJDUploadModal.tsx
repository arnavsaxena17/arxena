import { ArxJDUploadModal } from '@/arx-jd-upload/components/ArxJDUploadModal';
import {
  arxUploadJDModalModeState,
  isArxUploadJDModalOpenState,
} from '@/arx-jd-upload/states/arxUploadJDModalOpenState';
import { projectIdAtom } from '@/candidate-table/states/states';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

// Mount once at app level so nav "+" (and other openers) work on any route
export const GlobalArxJDUploadModal = () => {
  const isArxUploadJDModalOpen = useAtomStateValue(
    isArxUploadJDModalOpenState,
  );
  const arxUploadJDModalMode = useAtomStateValue(arxUploadJDModalModeState);
  const projectId = useAtomStateValue(projectIdAtom);

  if (!isArxUploadJDModalOpen) {
    return null;
  }

  return (
    <ArxJDUploadModal
      objectNameSingular="project"
      objectRecordId={
        arxUploadJDModalMode === 'edit' ? projectId || '0' : ''
      }
    />
  );
};
