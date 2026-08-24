import { defineLogicFunction } from 'twenty-sdk/define';

import { DOWNLOAD_SHORTLIST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/logic-function-universal-identifiers';
import { postHostJson } from 'src/logic-functions/data/post-host-json.util';

const handler = async (params: {
  records: Array<{ id: string }>;
}): Promise<{ requestedCount: number }> => {
  const records = params.records ?? [];
  const candidateIds = records.map((record) => record.id);

  await postHostJson({
    path: '/arx-delivery/download-shortlist-document',
    body: { candidateIds },
  });

  return { requestedCount: candidateIds.length };
};

export default defineLogicFunction({
  universalIdentifier:
    DOWNLOAD_SHORTLIST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'download-shortlist',
  description: 'Download shortlist documents for selected candidates',
  timeoutSeconds: 120,
  handler,
  httpRouteTriggerSettings: {
    path: '/download-shortlist',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
