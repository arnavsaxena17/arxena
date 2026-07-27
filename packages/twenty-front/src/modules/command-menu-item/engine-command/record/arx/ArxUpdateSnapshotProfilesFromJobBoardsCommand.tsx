import { HeadlessEngineCommandWrapperEffect } from '@/command-menu-item/engine-command/components/HeadlessEngineCommandWrapperEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useArxCommandConfirmationFlow } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCommandConfirmationFlow';
import { ARX_UPDATE_SNAPSHOT_PROFILES_MODAL_ID } from '@/command-menu-item/engine-command/record/arx/constants/arxCommandModalIds';
import { startNaukriQueueFromPage } from '@/chrome-extension/utils/naukriQueueExtensionBridge';
import { naukriQueueStatusState } from '@/candidate-table/states/naukriQueueStatusState';
import { useUpdateSnapshotProfilesFromJobBoards } from '@/object-record/hooks/useUpdateSnapshotProfilesFromJobBoards';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ConfirmationModal } from '@/ui/layout/modal/components/ConfirmationModal';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';

export const ArxUpdateSnapshotProfilesFromJobBoardsCommand = () => {
  const { objectMetadataItem, selectedRecordCount, resolveRecords } =
    useArxCandidateRecordsFromHeadlessContext({
      recordGqlFields: {
        id: true,
        peopleId: true,
        uniqueStringKey: true,
        source: true,
        resdexNaukriUrl: true,
        hiringNaukriUrl: true,
        linkedinUrl: true,
        candidateId: true,
        personId: true,
      },
    });
  const { isConfirmed, handleCancel, handleConfirm } =
    useArxCommandConfirmationFlow(ARX_UPDATE_SNAPSHOT_PROFILES_MODAL_ID);
  const setNaukriQueueStatus = useSetAtomState(naukriQueueStatusState);
  const {
    enqueueSuccessSnackBar,
    enqueueErrorSnackBar,
    enqueueWarningSnackBar,
    enqueueInfoSnackBar,
  } = useSnackBar();
  const [isProcessing, setIsProcessing] = useState(false);

  const { updateSnapshotProfiles } = useUpdateSnapshotProfilesFromJobBoards({
    onSuccess: () => {
      enqueueSuccessSnackBar({
        message: 'Snapshot profiles updated successfully',
        options: { duration: 3000 },
      });
    },
    onError: (error) => {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update snapshot profiles',
        options: { duration: 5000 },
      });
    },
  });

  const handleExecute = useCallback(async () => {
    if (!isDefined(objectMetadataItem) || isProcessing) {
      return;
    }

    try {
      setIsProcessing(true);
      const recordsToUpdate = await resolveRecords();

      if (recordsToUpdate.length === 0) {
        enqueueWarningSnackBar({
          message: 'No records selected to update',
          options: { duration: 3000 },
        });
        return;
      }

      const naukriRecords = recordsToUpdate.filter((record) => {
        const source = record.source as string | undefined;
        return (
          source?.includes('naukri') ||
          (record.hiringNaukriUrl as { primaryLinkUrl?: string } | undefined)
            ?.primaryLinkUrl?.trim() ||
          (record.resdexNaukriUrl as { primaryLinkUrl?: string } | undefined)
            ?.primaryLinkUrl?.trim()
        );
      });

      if (naukriRecords.length > 0) {
        const naukriUrls = naukriRecords
          .map(
            (record) =>
              (
                record.hiringNaukriUrl as
                  | { primaryLinkUrl?: string }
                  | undefined
              )?.primaryLinkUrl?.trim() ||
              (
                record.resdexNaukriUrl as
                  | { primaryLinkUrl?: string }
                  | undefined
              )?.primaryLinkUrl?.trim(),
          )
          .filter((url): url is string => Boolean(url));

        if (naukriUrls.length > 0) {
          const snapshot = await startNaukriQueueFromPage({
            urls: naukriUrls,
            currentTableId: objectMetadataItem.id,
          });

          if (snapshot) {
            setNaukriQueueStatus(snapshot);
          }

          enqueueInfoSnackBar({
            message: `Queued ${naukriUrls.length} Naukri profile(s). Processing in throttled batches.`,
            options: { duration: 4000 },
          });
          return;
        }
      }

      const isCandidateObject =
        objectMetadataItem.nameSingular.toLowerCase().includes('candidate') &&
        !objectMetadataItem.nameSingular
          .toLowerCase()
          .includes('jobcandidate');

      let candidateIdsToUpdate: string[] = [];
      let personIdsToUpdate: string[] = [];
      let uniqueStringKeysToUpdate: string[] = [];

      if (isCandidateObject) {
        candidateIdsToUpdate = recordsToUpdate.map((record) => record.id);
        personIdsToUpdate = recordsToUpdate
          .map((record) => record.peopleId as string | undefined)
          .filter(isDefined);
        uniqueStringKeysToUpdate = recordsToUpdate
          .map((record) => record.uniqueStringKey as string | undefined)
          .filter(isDefined);
      } else if (
        objectMetadataItem.nameSingular.toLowerCase().includes('jobcandidate')
      ) {
        candidateIdsToUpdate = recordsToUpdate
          .map((record) => record.candidateId as string | undefined)
          .filter(isDefined);
        personIdsToUpdate = recordsToUpdate
          .map((record) => record.personId as string | undefined)
          .filter(isDefined);
        uniqueStringKeysToUpdate = recordsToUpdate
          .map((record) => record.uniqueStringKey as string | undefined)
          .filter(isDefined);
      }

      await updateSnapshotProfiles(
        candidateIdsToUpdate,
        uniqueStringKeysToUpdate,
        personIdsToUpdate,
        objectMetadataItem.nameSingular,
      );
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update snapshot profiles',
        options: { duration: 5000 },
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    enqueueErrorSnackBar,
    enqueueInfoSnackBar,
    enqueueWarningSnackBar,
    isProcessing,
    objectMetadataItem,
    resolveRecords,
    setNaukriQueueStatus,
    updateSnapshotProfiles,
  ]);

  return (
    <>
      <ConfirmationModal
        modalInstanceId={ARX_UPDATE_SNAPSHOT_PROFILES_MODAL_ID}
        title="Update Snapshot Profiles"
        subtitle={`Are you sure you want to update snapshot profiles for ${selectedRecordCount} selected record(s)?`}
        onConfirmClick={handleConfirm}
        onClose={handleCancel}
        confirmButtonText="Update Snapshots"
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
