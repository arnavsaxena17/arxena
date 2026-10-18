import { tokenPairState } from '@/auth/states/tokenPairState';
import { useArxCandidateRecordsFromHeadlessContext } from '@/command-menu-item/engine-command/record/arx/hooks/useArxCandidateRecordsFromHeadlessContext';
import { buildOutreachSelectionPayload } from '@/command-menu-item/engine-command/record/arx/utils/resolve-people-and-candidate-ids-from-records.util';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isDefined } from 'twenty-shared/utils';
import { REACT_APP_SERVER_BASE_URL } from '~/config';

type GenerateSampleLinkedinMessageResponse = {
  success: boolean;
  runId?: string;
  total?: number;
  status?: string;
  error?: string;
};

const readOutreachProjectId = (
  records: Array<Record<string, unknown>>,
  search: string,
): string | undefined => {
  for (const record of records) {
    const projectId = record.outreachProjectId;

    if (typeof projectId === 'string' && projectId.length > 0) {
      return projectId;
    }
  }

  const fromQuery = new URLSearchParams(search).get('projectId');

  return isDefined(fromQuery) && fromQuery.length > 0 ? fromQuery : undefined;
};

export const useArxGenerateSampleLinkedinMessage = () => {
  const [loading, setLoading] = useState(false);
  const location = useLocation();
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

  const generateSampleLinkedinMessage =
    useCallback(async (): Promise<GenerateSampleLinkedinMessageResponse> => {
      const token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;

      if (!isDefined(token)) {
        throw new Error('Authentication required');
      }

      const records = await resolveRecords();
      const body = buildOutreachSelectionPayload(
        records,
        objectMetadataItem?.nameSingular ?? 'candidate',
      );
      const projectId = readOutreachProjectId(
        records as Array<Record<string, unknown>>,
        location.search,
      );

      if (!isDefined(projectId)) {
        throw new Error('Open an Outreach project first');
      }

      if (body.personIds.length === 0 && body.candidateIds.length === 0) {
        throw new Error('Please select at least one person');
      }

      setLoading(true);

      try {
        const response =
          await axios.post<GenerateSampleLinkedinMessageResponse>(
            `${REACT_APP_SERVER_BASE_URL}/outreach-command/generate-sample-linkedin-message`,
            {
              projectId,
              ...body,
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
            response.data.error ?? 'Generate sample LinkedIn message failed',
          );
        }

        return response.data;
      } finally {
        setLoading(false);
      }
    }, [
      location.search,
      objectMetadataItem?.nameSingular,
      resolveRecords,
      tokenPair,
    ]);

  return { generateSampleLinkedinMessage, loading };
};
