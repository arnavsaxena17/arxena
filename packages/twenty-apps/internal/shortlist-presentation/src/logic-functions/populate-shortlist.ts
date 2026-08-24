import { defineLogicFunction } from 'twenty-sdk/define';

import { POPULATE_SHORTLIST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/logic-function-universal-identifiers';
import { postHostJson } from 'src/logic-functions/data/post-host-json.util';

const handler = async (params: {
  records: Array<{ id: string }>;
}): Promise<{ populatedCount: number }> => {
  const records = params.records ?? [];
  const candidateIds = records.map((record) => record.id);

  await postHostJson({
    path: '/arx-delivery/create-shortlist',
    body: { candidateIds },
  });

  return { populatedCount: candidateIds.length };
};

export default defineLogicFunction({
  universalIdentifier:
    POPULATE_SHORTLIST_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'populate-shortlist',
  description: 'Populate shortlist records for selected candidates',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/populate-shortlist',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
