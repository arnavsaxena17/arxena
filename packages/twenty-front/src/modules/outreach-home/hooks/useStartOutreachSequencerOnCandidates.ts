import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useFindManyRecordsQuery } from '@/object-record/hooks/useFindManyRecordsQuery';
import { useFindOneRecord } from '@/object-record/hooks/useFindOneRecord';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { OUTREACH_WORKFLOW_SEQUENCER_NAME } from '@/outreach-home/constants/outreach-command.constants';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useRunWorkflowVersion } from '@/workflow/hooks/useRunWorkflowVersion';
import { type WorkflowVersion } from '@/workflow/types/Workflow';
import { useCallback, useState } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined, isNonEmptyArray } from 'twenty-shared/utils';

type SequencerWorkflowRecord = ObjectRecord & {
  name?: string;
  lastPublishedVersionId?: string | null;
  versions?: Array<{ id: string; status: string }> | null;
};

export const useStartOutreachSequencerOnCandidates = () => {
  const [isStarting, setIsStarting] = useState(false);
  const apolloCoreClient = useApolloCoreClient();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const { runWorkflowVersion } = useRunWorkflowVersion();

  const { records: sequencerWorkflows } =
    useFindManyRecords<SequencerWorkflowRecord>({
      objectNameSingular: CoreObjectNameSingular.Workflow,
      filter: {
        name: {
          eq: OUTREACH_WORKFLOW_SEQUENCER_NAME,
        },
      },
      limit: 1,
      recordGqlFields: {
        id: true,
        name: true,
        lastPublishedVersionId: true,
        versions: {
          id: true,
          status: true,
        },
      },
    });

  const sequencerWorkflow = sequencerWorkflows[0];
  const activeVersionId =
    sequencerWorkflow?.versions?.find((version) => version.status === 'ACTIVE')
      ?.id ??
    sequencerWorkflow?.lastPublishedVersionId ??
    null;

  const { record: activeVersion } = useFindOneRecord<WorkflowVersion>({
    objectNameSingular: CoreObjectNameSingular.WorkflowVersion,
    objectRecordId: activeVersionId ?? undefined,
    skip: !isDefined(activeVersionId),
    recordGqlFields: {
      id: true,
      status: true,
      trigger: true,
    },
  });

  const isManualTrigger = activeVersion?.trigger?.type === 'MANUAL';

  const { findManyRecordsQuery } = useFindManyRecordsQuery({
    objectNameSingular: 'candidate',
    recordGqlFields: {
      id: true,
      name: true,
      outreachSequenceStage: true,
    },
  });

  const startSequencerOnCandidateIds = useCallback(
    async (candidateIds: string[]) => {
      const uniqueCandidateIds = [
        ...new Set(
          candidateIds.filter((candidateId) => isDefined(candidateId)),
        ),
      ];

      if (!isNonEmptyArray(uniqueCandidateIds)) {
        enqueueErrorSnackBar({
          message: 'Select enrolled people with candidates first',
        });

        return;
      }

      if (!isDefined(sequencerWorkflow?.id) || !isDefined(activeVersionId)) {
        enqueueErrorSnackBar({
          message:
            'Candidate Sequencer is not active. Activate the workflow first.',
        });

        return;
      }

      if (!isManualTrigger) {
        enqueueErrorSnackBar({
          message:
            'Switch Candidate Sequencer to Manual trigger in Edit Workflow, then activate.',
        });

        return;
      }

      setIsStarting(true);

      try {
        const queryResult = await apolloCoreClient.query<{
          candidates?: {
            edges?: Array<{ node?: ObjectRecord | null } | null> | null;
          };
        }>({
          query: findManyRecordsQuery,
          variables: {
            filter: { id: { in: uniqueCandidateIds } },
            limit: uniqueCandidateIds.length,
          },
          fetchPolicy: 'network-only',
        });

        const candidates = (queryResult.data?.candidates?.edges ?? [])
          .map((edge) => edge?.node)
          .filter((candidate): candidate is ObjectRecord =>
            isDefined(candidate),
          );

        if (!isNonEmptyArray(candidates)) {
          enqueueErrorSnackBar({
            message: 'Could not load candidate records for the selection',
          });

          return;
        }

        for (const candidate of candidates) {
          await runWorkflowVersion({
            workflowId: sequencerWorkflow.id,
            workflowVersionId: activeVersionId,
            payload: candidate,
          });
        }

        enqueueSuccessSnackBar({
          message: `Started sequencer for ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}`,
        });
      } catch (error) {
        enqueueErrorSnackBar({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to start sequencer',
        });
      } finally {
        setIsStarting(false);
      }
    },
    [
      activeVersionId,
      apolloCoreClient,
      enqueueErrorSnackBar,
      enqueueSuccessSnackBar,
      findManyRecordsQuery,
      isManualTrigger,
      runWorkflowVersion,
      sequencerWorkflow?.id,
    ],
  );

  return {
    isStarting,
    isManualTrigger,
    hasActiveSequencer: isDefined(activeVersionId),
    startSequencerOnCandidateIds,
  };
};
