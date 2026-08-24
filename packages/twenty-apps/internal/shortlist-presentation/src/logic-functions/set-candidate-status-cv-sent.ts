import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { SET_CANDIDATE_STATUS_CV_SENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/logic-function-universal-identifiers';

const handler = async (params: {
  records: Array<{ id: string }>;
}): Promise<{ updatedCount: number }> => {
  const records = params.records ?? [];
  const candidateIds = records.map((record) => record.id);

  if (candidateIds.length === 0) {
    return { updatedCount: 0 };
  }

  const client = new CoreApiClient();

  await client.mutation({
    updateCandidates: {
      __args: {
        filter: {
          id: { in: candidateIds },
        },
        data: {
          status: 'CV_SENT',
        },
      },
      id: true,
    },
  } as any);

  return { updatedCount: candidateIds.length };
};

export default defineLogicFunction({
  universalIdentifier:
    SET_CANDIDATE_STATUS_CV_SENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'set-candidate-status-cv-sent',
  description: 'Set selected candidates status to CV_SENT',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/set-candidate-status-cv-sent',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
