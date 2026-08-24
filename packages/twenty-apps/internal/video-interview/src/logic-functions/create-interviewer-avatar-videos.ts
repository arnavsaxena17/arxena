import { defineLogicFunction } from 'twenty-sdk/define';

import { CREATE_INTERVIEWER_AVATAR_VIDEOS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/logic-function-universal-identifiers';
import { postHostJson } from 'src/logic-functions/data/post-host-json.util';

const handler = async (params: {
  records: Array<{ id: string }>;
}): Promise<{ queuedCount: number }> => {
  const records = params.records ?? [];

  for (const record of records) {
    await postHostJson({
      path: '/arx-delivery/create-interview-videos',
      body: { projectId: record.id },
    });
  }

  return { queuedCount: records.length };
};

export default defineLogicFunction({
  universalIdentifier:
    CREATE_INTERVIEWER_AVATAR_VIDEOS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'create-interviewer-avatar-videos',
  description: 'Generate interviewer avatar videos for selected projects',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/create-interviewer-avatar-videos',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
