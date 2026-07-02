export type TestWebhookObjectMetadata = {
  id: string;
  nameSingular: string;
};

export type TestWebhookPayload = {
  targetUrl: string;
  eventName: string;
  objectMetadata: TestWebhookObjectMetadata;
  workspaceId: string;
  webhookId: string;
  eventDate: string;
  record: Record<string, unknown>;
  updatedFields?: string[];
};

export type CapturedTestWebhookEvent = {
  receivedAt: string;
  headers: {
    signature?: string;
    timestamp?: string;
    nonce?: string;
  };
  signatureValid: boolean | null;
  payload: TestWebhookPayload;
};
