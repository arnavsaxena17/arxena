import { tokenPairState } from '@/auth/states/tokenPairState';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
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
  const { objectMetadataItem, resolveRecordIds } =
    useArxCandidateRecordsFromHeadlessContext({
      recordGqlFields: { id: true },
    });

  const execute =
    useCallback(async (): Promise<OutreachSelectionCommandResponse> => {
      const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

      if (!isDefined(token)) {
        throw new Error('Authentication required');
      }

      const recordIds = await resolveRecordIds();

      if (recordIds.length === 0) {
        throw new Error('Please select at least one record');
      }

      const objectNameSingular = objectMetadataItem?.nameSingular;
      const body =
        objectNameSingular === 'person'
          ? { personIds: recordIds }
          : { candidateIds: recordIds };

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
      resolveRecordIds,
      tokenPair,
    ]);

  return { execute, loading };
};
