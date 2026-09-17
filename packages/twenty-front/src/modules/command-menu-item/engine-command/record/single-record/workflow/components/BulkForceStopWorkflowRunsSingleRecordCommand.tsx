import { HeadlessConfirmationModalEngineCommandEffect } from '@/command-menu-item/engine-command/components/HeadlessConfirmationModalEngineCommandEffect';
import { useHeadlessCommandContextApi } from '@/command-menu-item/engine-command/hooks/useHeadlessCommandContextApi';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useBulkForceStopWorkflowRuns } from '@/workflow/hooks/useBulkForceStopWorkflowRuns';
import { t } from '@lingui/core/macro';
import { isDefined } from 'twenty-shared/utils';

export const BulkForceStopWorkflowRunsSingleRecordCommand = () => {
  const { selectedRecords } = useHeadlessCommandContextApi();
  const { bulkForceStopWorkflowRuns } = useBulkForceStopWorkflowRuns();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();

  const recordId = selectedRecords[0]?.id;

  if (!isDefined(recordId)) {
    throw new Error('Record ID is required to bulk force stop workflow runs');
  }

  const handleExecute = async () => {
    try {
      const stoppedCount = await bulkForceStopWorkflowRuns(recordId);

      enqueueSuccessSnackBar({
        message: t`Force-stopped ${stoppedCount} workflow run${stoppedCount === 1 ? '' : 's'}`,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        message:
          error instanceof Error
            ? error.message
            : t`Failed to bulk force stop workflow runs`,
      });
    }
  };

  return (
    <HeadlessConfirmationModalEngineCommandEffect
      title={t`Bulk Force Stop`}
      subtitle={t`Stop all queued, enqueued, and running runs for this workflow? This cannot be undone.`}
      confirmButtonText={t`Bulk Force Stop`}
      execute={handleExecute}
    />
  );
};
