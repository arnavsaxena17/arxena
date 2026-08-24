import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineLogicFunction } from 'twenty-sdk/define';

import { SHARE_VIDEO_INTERVIEW_LINKS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/logic-function-universal-identifiers';
import { postHostJson } from 'src/logic-functions/data/post-host-json.util';

type ShareRecordsInput = {
  records: Array<{ id: string }>;
  recordObject?: 'candidate' | 'videoInterview';
};

const resolveCandidateId = async (
  record: { id: string },
  recordObject: ShareRecordsInput['recordObject'],
): Promise<string> => {
  if (recordObject !== 'videoInterview') {
    return record.id;
  }

  const client = new RestApiClient();
  const interview = await client.get<{ candidateId?: string }>(
    `/rest/videoInterviews/${record.id}`,
  );

  if (!interview?.candidateId) {
    throw new Error(`Video interview ${record.id} has no candidate`);
  }

  return interview.candidateId;
};

const handler = async (
  params: ShareRecordsInput,
): Promise<{ sharedCount: number }> => {
  const records = params.records ?? [];

  for (const record of records) {
    const candidateId = await resolveCandidateId(record, params.recordObject);

    await postHostJson({
      path: '/video-interview-process/send-video-interview-to-candidate',
      body: { candidateId },
    });
  }

  return { sharedCount: records.length };
};

export default defineLogicFunction({
  universalIdentifier:
    SHARE_VIDEO_INTERVIEW_LINKS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'share-video-interview-links',
  description: 'Share video interview links with selected candidates',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: '/share-video-interview-links',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
