import { defineLogicFunction } from 'twenty-sdk/define';

import { CREATE_VIDEO_INTERVIEW_LINKS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/logic-function-universal-identifiers';
import { postHostJson } from 'src/logic-functions/data/post-host-json.util';

const handler = async (params: {
  records: Array<{ id: string }>;
}): Promise<{ createdCount: number }> => {
  const records = params.records ?? [];

  for (const record of records) {
    await postHostJson({
      path: '/video-interview-process/create-video-interview',
      body: { candidateId: record.id },
    });
  }

  return { createdCount: records.length };
};

export default defineLogicFunction({
  universalIdentifier:
    CREATE_VIDEO_INTERVIEW_LINKS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'create-video-interview-links',
  description: 'Create video interview links for selected candidates',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/create-video-interview-links',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
