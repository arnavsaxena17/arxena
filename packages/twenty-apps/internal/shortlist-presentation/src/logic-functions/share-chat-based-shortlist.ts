import { defineLogicFunction } from 'twenty-sdk/define';

import { SHARE_CHAT_BASED_SHORTLIST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/logic-function-universal-identifiers';
import { postHostJson } from 'src/logic-functions/data/post-host-json.util';

const handler = async (params: {
  records: Array<{ id: string }>;
}): Promise<{ sharedCount: number }> => {
  const records = params.records ?? [];
  const candidateIds = records.map((record) => record.id);

  await postHostJson({
    path: '/arx-delivery/chat-based-shortlist-delivery',
    body: { candidateIds },
  });

  return { sharedCount: candidateIds.length };
};

export default defineLogicFunction({
  universalIdentifier:
    SHARE_CHAT_BASED_SHORTLIST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'share-chat-based-shortlist',
  description: 'Share chat-based shortlist delivery for selected candidates',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/share-chat-based-shortlist',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
