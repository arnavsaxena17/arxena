import { createHmac, timingSafeEqual } from 'crypto';

import { TestWebhookPayload } from 'src/engine/core-modules/test-webhook/types/test-webhook-payload.type';

type VerifyTwentyWebhookSignatureArgs = {
  payload: TestWebhookPayload;
  secret: string;
  timestamp: string;
  signature: string;
};

const secureCompareHex = (provided: string, expected: string): boolean => {
  const providedBytes = new TextEncoder().encode(provided);
  const expectedBytes = new TextEncoder().encode(expected);

  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(providedBytes, expectedBytes);
};

export const verifyTwentyWebhookSignature = ({
  payload,
  secret,
  timestamp,
  signature,
}: VerifyTwentyWebhookSignatureArgs): boolean => {
  const expectedSignature = createHmac('sha256', secret)
    .update(`${timestamp}:${JSON.stringify(payload)}`)
    .digest('hex');

  return secureCompareHex(signature, expectedSignature);
};
