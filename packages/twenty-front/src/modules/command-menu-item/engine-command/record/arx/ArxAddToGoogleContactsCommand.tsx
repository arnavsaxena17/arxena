import { tokenPairState } from '@/auth/states/tokenPairState';
import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_ADD_GOOGLE_CONTACTS_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const ArxAddToGoogleContactsCommand = () => {
  const { objectMetadataItem, selectedRecordCount, resolveRecordIds } =
    useArxCandidateRecordsFromHeadlessContext();
  const tokenPair = useAtomStateValue(tokenPairState);
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_ADD_GOOGLE_CONTACTS_MODAL_ID);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar } =
    useSnackBar();
  const [pendingCandidateIds, setPendingCandidateIds] = useState<
    string[] | null
  >(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    resolveRecordIds()
      .then(setPendingCandidateIds)
      .catch((error) => {
        enqueueErrorSnackBar({
          message:
            error instanceof Error ? error.message : 'Error validating candidates',
          options: { duration: 5000 },
        });
        handleCancel();
      });
  }, [enqueueErrorSnackBar, handleCancel, resolveRecordIds]);

  const handleExecute = useCallback(async () => {
    if (!isDefined(objectMetadataItem) || isProcessing) {
      return;
    }

    if (!pendingCandidateIds?.length) {
      enqueueWarningSnackBar({
        message: 'No candidates selected to add to Google Contacts',
        options: { duration: 5000 },
      });
      return;
    }

    try {
      setIsProcessing(true);
      const response = await axios.post(
        `${REACT_APP_SERVER_BASE_URL}/contacts/add-candidate-to-google-contacts`,
        {
          candidateIds: pendingCandidateIds,
          objectNameSingular: objectMetadataItem.nameSingular,
        },
        {
          headers: {
            Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const result = response.data;

      if (!result?.success) {
        throw new Error(
          result?.error ||
            result?.message ||
            'Failed to add candidates to Google Contacts. Connect Google Contacts in Settings > Account.',
        );
      }

      enqueueSuccessSnackBar({
        message: `Successfully added ${result.created || 0} candidates to Google Contacts. ${result.skipped || 0} candidates were already in contacts.`,
        options: { duration: 5000 },
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Error adding candidates to Google Contacts',
        options: { duration: 5000 },
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    enqueueErrorSnackBar,
    enqueueSuccessSnackBar,
    enqueueWarningSnackBar,
    isProcessing,
    objectMetadataItem,
    pendingCandidateIds,
    tokenPair?.accessOrWorkspaceAgnosticToken?.token,
  ]);

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_ADD_GOOGLE_CONTACTS_MODAL_ID}
        title="Add to Google Contacts"
        subtitle={`Are you sure you want to add ${pendingCandidateIds?.length ?? selectedRecordCount} selected candidate(s) to Google Contacts?`}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Add to Google Contacts"
        confirmButtonAccent="blue"
        loading={isProcessing}
      />
      <HeadlessEngineCommandWrapperEffect
        execute={handleExecute}
        ready={isConfirmed}
      />
    </>
  );
};
