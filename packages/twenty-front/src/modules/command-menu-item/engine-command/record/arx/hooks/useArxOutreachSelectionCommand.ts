import { tokenPairState } from '@/auth/states/tokenPairState';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { buildOutreachSelectionPayload } from '@/command-menu-item/engine-command/record/arx/utils/resolve-people-and-candidate-ids-from-records.util';
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
          body,
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
      resolveRecords,
      tokenPair,
    ]);

  return { execute, loading };
};
