import crypto from 'crypto';

import { verifyTwentyWebhookSignature } from 'src/engine/core-modules/test-webhook/utils/verify-twenty-webhook-signature.util';

describe('verifyTwentyWebhookSignature', () => {
  const secret = 'test-webhook-secret';
  const payload = {
    targetUrl: 'https://arxena.com/test-webhook/webhook',
    eventName: 'opportunity.created',
    objectMetadata: {
      id: '370985db-22d8-4463-8e5f-2271d30913bd',
      nameSingular: 'opportunity',
    },
    workspaceId: '872cfcf1-c79f-42bc-877d-5829f06eb3f9',
    webhookId: '90056586-1228-4e03-a507-70140aa85c05',
    eventDate: '2024-02-14T11:27:01.779Z',
    record: {
      id: 'record-id',
      name: 'New opportunity',
    },
  };

  it('returns true for a valid signature', () => {
    const timestamp = '1735066639761';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}:${JSON.stringify(payload)}`)
      .digest('hex');

    expect(
      verifyTwentyWebhookSignature({
        payload,
        secret,
        timestamp,
        signature,
      }),
    ).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    expect(
      verifyTwentyWebhookSignature({
        payload,
        secret,
        timestamp: '1735066639761',
        signature: 'deadbeef',
      }),
    ).toBe(false);
  });
});
