import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineLogicFunction } from 'twenty-sdk/define';

import { CREATE_CV_SENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/logic-function-universal-identifiers';

const handler = async (params: {
  records: Array<{ id: string; name?: string }>;
}): Promise<{ createdCount: number; cvSentIds: string[] }> => {
  const records = params.records ?? [];
  const client = new CoreApiClient();
  const cvSentIds: string[] = [];

  for (const record of records) {
    const projectName = record.name ?? 'Project';
    const { createCvSent } = (await client.mutation({
      createCvSent: {
        __args: {
          data: {
            name: `CV Sent - ${projectName}`,
            projectId: record.id,
          },
        },
        id: true,
      },
    } as any)) as any;

    if (createCvSent?.id) {
      cvSentIds.push(createCvSent.id);
    }
  }

  return { createdCount: cvSentIds.length, cvSentIds };
};

export default defineLogicFunction({
  universalIdentifier: CREATE_CV_SENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'create-cv-sent',
  description: 'Create a CV Sent record for selected projects',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/create-cv-sent',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
