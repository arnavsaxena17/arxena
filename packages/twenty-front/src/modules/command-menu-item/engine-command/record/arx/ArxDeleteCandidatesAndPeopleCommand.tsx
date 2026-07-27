import { tokenPairState } from '@/auth/states/tokenPairState';
import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_DELETE_CANDIDATES_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { dataTableRefreshFunctionState } from '@/candidate-table/states/dataTableRefreshFunctionState';
import { useExecuteDeleteCandidatesAndPeople } from '@/object-record/hooks/useExecuteDeleteCandidatesAndPeople';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

export const ArxDeleteCandidatesAndPeopleCommand = () => {
  const { objectMetadataItem, selectedRecordCount, resolveRecordIds } =
    useArxCandidateRecordsFromHeadlessContext({ recordGqlFields: { id: true } });
  const dataTableRefreshFunction = useAtomStateValue(
    dataTableRefreshFunctionState,
  );
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_DELETE_CANDIDATES_MODAL_ID);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar } =
    useSnackBar();
  const [isProcessing, setIsProcessing] = useState(false);

  const { deleteCandidatesAndPeople } = useExecuteDeleteCandidatesAndPeople({
    objectNameSingular: objectMetadataItem?.nameSingular ?? 'candidate',
    onRefresh: dataTableRefreshFunction ?? undefined,
  });

  const handleExecute = useCallback(async () => {
    if (!isDefined(objectMetadataItem) || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      const recordIds = await resolveRecordIds();

      if (recordIds.length === 0) {
        enqueueWarningSnackBar({
          message: 'No records selected for deletion',
          options: { duration: 3000 },
        });
        return;
      }

      await deleteCandidatesAndPeople(recordIds);
      enqueueSuccessSnackBar({
        message: 'Records deleted successfully',
        options: { duration: 3000 },
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Failed to delete records',
        options: { duration: 5000 },
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    deleteCandidatesAndPeople,
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    enqueueWarningSnackBar,
    isProcessing,
    objectMetadataItem,
    resolveRecordIds,
  ]);

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_DELETE_CANDIDATES_MODAL_ID}
        title="Delete Multiple Candidates and People"
        subtitle={`Are you sure you want to delete ${selectedRecordCount} selected record(s)?`}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Delete Multiple Candidates and People"
        confirmButtonAccent="danger"
        loading={isProcessing}
      />
      <HeadlessEngineCommandWrapperEffect
        execute={handleExecute}
        ready={isConfirmed}
      />
    </>
  );
};
