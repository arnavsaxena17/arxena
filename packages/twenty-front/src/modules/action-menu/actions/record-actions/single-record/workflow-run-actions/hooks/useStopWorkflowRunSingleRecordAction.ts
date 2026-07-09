import { useSelectedRecordIdOrThrow } from '@/action-menu/actions/record-actions/single-record/hooks/useSelectedRecordIdOrThrow';
import { ActionHookWithoutObjectMetadataItem } from '@/action-menu/actions/types/ActionHook';
import { CoreObjectNameSingular } from '@/object-metadata/types/CoreObjectNameSingular';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { useStopWorkflowRun } from '@/workflow/hooks/useStopWorkflowRun';
import { isDefined } from 'twenty-shared';

export const useStopWorkflowRunSingleRecordAction: ActionHookWithoutObjectMetadataItem =
  () => {
    const recordId = useSelectedRecordIdOrThrow();
    const { stopWorkflowRun } = useStopWorkflowRun();

    const { record: workflowRun } = useFindOneRecord<{
      id: string;
      status: string;
    }>({
      objectNameSingular: CoreObjectNameSingular.WorkflowRun,
      objectRecordId: recordId,
      recordGqlFields: {
        id: true,
        status: true,
      },
    });

    const shouldBeRegistered =
      isDefined(workflowRun) &&
      (workflowRun.status === 'RUNNING' ||
        workflowRun.status === 'NOT_STARTED' ||
        workflowRun.status === 'STOPPING');

    const onClick = async () => {
      if (!shouldBeRegistered) {
        return;
      }

      await stopWorkflowRun(recordId);
    };

    return {
      shouldBeRegistered,
      onClick,
    };
  };
