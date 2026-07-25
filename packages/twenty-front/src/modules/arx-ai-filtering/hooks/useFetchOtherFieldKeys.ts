import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useCallback, useState } from 'react';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export type OtherFieldKey = {
  name: string;
  label: string;
};

export const useFetchOtherFieldKeys = () => {
  const [otherFieldKeys, setOtherFieldKeys] = useState<OtherFieldKey[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const tokenPair = useAtomStateValue(tokenPairState);

  const fetchOtherFieldKeys = useCallback(
    async (projectId: string) => {
      if (
        !projectId ||
        projectId === 'project-id' ||
        projectId === 'undefined' ||
        projectId === 'null'
      ) {
        console.log('Skipping fetchOtherFieldKeys for invalid projectId:', projectId);
        return;
      }

      try {
        console.log('Fetching otherField keys for job ID:', projectId);
        setIsLoadingFields(true);
        setApiError(null);

        const response = await axios.post(
          `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/get-candidate-fields-by-project`,
          { projectId },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
            },
          },
        );

        console.log('Response from fetch otherField keys:', response.data);

        const fieldKeys: OtherFieldKey[] | undefined =
          response.data.otherFieldKeys ?? response.data.candidateFields;

        if (response.data.status === 'Success' && fieldKeys) {
          console.log('Received otherField keys:', fieldKeys);
          setOtherFieldKeys(fieldKeys);
          setApiError(null);
        } else if (response.data.status === 'Failed') {
          console.warn(
            'API returned error:',
            response.data.message || response.data.error,
          );
          setApiError(
            response.data.message ||
              response.data.error ||
              'Failed to fetch otherField keys',
          );
        } else {
          console.warn(
            'No otherField keys returned from API or unexpected response format',
          );
          setApiError('No custom fields found for this job');
        }
      } catch (error) {
        console.error('Error fetching otherField keys:', error);
        setApiError('Error fetching otherField keys');
      } finally {
        setIsLoadingFields(false);
      }
    },
    [tokenPair?.accessOrWorkspaceAgnosticToken?.token],
  );

  return {
    otherFieldKeys,
    isLoadingFields,
    apiError,
    fetchOtherFieldKeys,
    setOtherFieldKeys,
    setApiError,
  };
};
