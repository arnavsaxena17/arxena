import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useHeadlessCommandContextApi } from '@/command-menu-item/engine-command/hooks/useHeadlessCommandContextApi';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { getProjectIdFromPathname } from '@/command-menu-item/engine-command/record/arx/utils/isProjectRoute';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';

export const ArxShareChatAndVideoInterviewBasedShortlistCommand = () => {
  const { selectedRecords } = useHeadlessCommandContextApi();
  const { resolveRecordIds } = useArxCandidateRecordsFromHeadlessContext({
    recordGqlFields: { id: true },
  });
  const location = useLocation();
  const { enqueueErrorSnackBar } = useSnackBar();

  const handleExecute = useCallback(async () => {
    const candidateIds = await resolveRecordIds();
    const projectId = getProjectIdFromPathname(location.pathname);

    // TODO: Port ShortlistEditModal from workflows action-menu components
    if (candidateIds.length === 0 && selectedRecords.length === 0) {
      enqueueErrorSnackBar({
        message: 'No candidates selected for shortlist sharing',
        options: { duration: 5000 },
      });
      return;
    }

    enqueueErrorSnackBar({
      message: `Shortlist edit modal not yet ported (project: ${projectId ?? 'unknown'}, candidates: ${candidateIds.length})`,
      options: { duration: 5000 },
    });
  }, [
    enqueueErrorSnackBar,
    location.pathname,
    resolveRecordIds,
    selectedRecords.length,
  ]);

  return <HeadlessEngineCommandWrapperEffect execute={handleExecute} />;
};
