import { defineLogicFunction } from 'twenty-sdk/define';

import { CREATE_SHORTLIST_DOCUMENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/logic-function-universal-identifiers';
import { postHostJson } from 'src/logic-functions/data/post-host-json.util';

const handler = async (params: {
  records: Array<{ id: string }>;
}): Promise<{ createdCount: number }> => {
  const records = params.records ?? [];
  const candidateIds = records.map((record) => record.id);

  await postHostJson({
    path: '/arx-delivery/create-shortlist-document',
    body: { candidateIds },
  });

  return { createdCount: candidateIds.length };
};

export default defineLogicFunction({
  universalIdentifier:
    CREATE_SHORTLIST_DOCUMENT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'create-shortlist-document',
  description: 'Create shortlist PDF and Excel documents for selected candidates',
  timeoutSeconds: 120,
  handler,
  httpRouteTriggerSettings: {
    path: '/create-shortlist-document',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
