import { defineLogicFunction } from 'twenty-sdk/define';

import { DOWNLOAD_CANDIDATE_CVS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/logic-function-universal-identifiers';
import { postHostJson } from 'src/logic-functions/data/post-host-json.util';

// Note: twenty-front currently zips candidate attachment CVs client-side.
// Until a dedicated Nest CV-zip endpoint exists, proxy to download-shortlist-document.
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
    DOWNLOAD_CANDIDATE_CVS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'download-candidate-cvs',
  description:
    'Download candidate CVs (proxies to /arx-delivery/download-shortlist-document until a dedicated CV zip endpoint exists)',
  timeoutSeconds: 120,
  handler,
  httpRouteTriggerSettings: {
    path: '/download-candidate-cvs',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
