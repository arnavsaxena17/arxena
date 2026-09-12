import { tokenPairState } from '@/auth/states/tokenPairState';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type QualifyProspectResponse = {
  success: boolean;
  results?: Array<{
    candidateId: string;
    success: boolean;
    go?: boolean;
    score?: number;
    error?: string;
  }>;
  error?: string;
};

export const useArxQualifyProspect = () => {
  const [loading, setLoading] = useState(false);
  const tokenPair = useAtomStateValue(tokenPairState);
  const { objectMetadataItem, resolveRecordIds } =
    useArxCandidateRecordsFromHeadlessContext({
      recordGqlFields: { id: true },
    });

  const qualifyProspect =
    useCallback(async (): Promise<QualifyProspectResponse> => {
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
        const response = await axios.post<QualifyProspectResponse>(
          `${REACT_APP_SERVER_BASE_URL}/outreach-command/qualify-prospect`,
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
              'Qualify prospect failed',
          );
        }

        return response.data;
      } finally {
        setLoading(false);
      }
    }, [objectMetadataItem?.nameSingular, resolveRecordIds, tokenPair]);

  return { qualifyProspect, loading };
};
