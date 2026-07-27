import { HeadlessConfirmationModalEngineCommandEffect } from '@/command-menu-item/engine-command/components/HeadlessConfirmationModalEngineCommandEffect';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useCloneMultipleRecords } from '@/object-record/hooks/useCloneMultipleRecords';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { isDefined } from 'twenty-shared/utils';

export const ArxCloneMultipleRecordsCommand = () => {
  const { objectMetadataItem, selectedRecordCount, resolveRecordIds } =
    useArxCandidateRecordsFromHeadlessContext({ recordGqlFields: { id: true } });
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueWarningSnackBar } =
    useSnackBar();

  if (!isDefined(objectMetadataItem)) {
    throw new Error('Object metadata is required to clone records');
  }

  const { cloneMultipleRecords } = useCloneMultipleRecords({
    objectNameSingular: objectMetadataItem.nameSingular,
    recordGqlFields: { id: true },
    skipPostOptimisticEffect: false,
  });

  const handleExecute = async () => {
    const recordIdsToClone = await resolveRecordIds();

    if (recordIdsToClone.length === 0) {
      enqueueWarningSnackBar({
        message: 'No records selected to clone',
        options: { duration: 3000 },
      });
      return;
    }

    try {
      await cloneMultipleRecords(recordIdsToClone);
      enqueueSuccessSnackBar({
        message: 'Records cloned successfully',
        options: { duration: 3000 },
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error ? error.message : 'Failed to clone records',
        options: { duration: 5000 },
      });
    }
  };

  return (
    <HeadlessConfirmationModalEngineCommandEffect
      title="Clone Multiple Records"
      subtitle={`Are you sure you want to clone ${selectedRecordCount} selected record(s)?`}
      confirmButtonText="Clone Multiple Records"
      confirmButtonAccent="danger"
      execute={handleExecute}
    />
  );
};
