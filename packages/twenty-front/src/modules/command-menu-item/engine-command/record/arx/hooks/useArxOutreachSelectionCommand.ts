import { tokenPairState } from '@/auth/states/tokenPairState';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { buildOutreachSelectionPayload } from '@/command-menu-item/engine-command/record/arx/utils/resolve-people-and-candidate-ids-from-records.util';
import { outreachContextState } from '@/outreach-home/states/outreachContextState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type OutreachSelectionCommandResponse = {
  success: boolean;
  results?: Array<{
    candidateId: string;
    success: boolean;
    total?: number;
    error?: string;
  }>;
  startedCandidates?: number;
  stoppedCandidates?: number;
  stoppedRuns?: number;
  // Present when Start Outreach also had to enroll the selection
  enrollingPersonIds?: string[];
  skippedDoNotContact?: number;
  message?: string;
  error?: string;
};

export const useArxOutreachSelectionCommand = ({
  endpoint,
  failureMessage,
}: {
  endpoint: string;
  failureMessage: string;
}) => {
  const [loading, setLoading] = useState(false);
  const tokenPair = useAtomStateValue(tokenPairState);
  const outreachContext = useAtomStateValue(outreachContextState);
  const { objectMetadataItem, resolveRecords } =
    useArxCandidateRecordsFromHeadlessContext({
      recordGqlFields: {
        id: true,
        peopleId: true,
        personId: true,
        candidateId: true,
        people: true,
      },
    });

  const execute =
    useCallback(async (): Promise<OutreachSelectionCommandResponse> => {
      const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

      if (!isDefined(token)) {
        throw new Error('Authentication required');
      }

      const records = await resolveRecords();
      const body = buildOutreachSelectionPayload(
        records,
        objectMetadataItem?.nameSingular ?? 'candidate',
      );

      if (body.personIds.length === 0 && body.candidateIds.length === 0) {
        throw new Error('Please select at least one record');
      }

      setLoading(true);

      try {
        const response = await axios.post<OutreachSelectionCommandResponse>(
          `${REACT_APP_SERVER_BASE_URL}${endpoint}`,
          {
            ...body,
            // The server resolves People-tab hash ids against the project's
            // people list, and enrolls the ones that are not Candidates yet.
            ...(isDefined(outreachContext.projectId)
              ? { projectId: outreachContext.projectId }
              : {}),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (!response.data.success) {
          throw new Error(
            response.data.error ??
              response.data.results?.find((result) => !result.success)?.error ??
              failureMessage,
          );
        }

        return response.data;
      } finally {
        setLoading(false);
      }
    }, [
      endpoint,
      failureMessage,
      objectMetadataItem?.nameSingular,
      outreachContext.projectId,
      resolveRecords,
      tokenPair,
    ]);

  return { execute, loading };
};
