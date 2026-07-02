import { TestWebhookService } from 'src/engine/core-modules/test-webhook/test-webhook.service';

describe('TestWebhookService', () => {
  const createService = (env: Record<string, string | undefined> = {}) => {
    const environmentService = {
      get: (key: string) => env[key],
    };

    return new TestWebhookService(environmentService as never);
  };

  const samplePayload = {
    targetUrl: 'https://arxena.com/test-webhook/webhook',
    eventName: 'opportunity.created',
    objectMetadata: {
      id: 'object-metadata-id',
      nameSingular: 'opportunity',
    },
    workspaceId: 'workspace-id',
    webhookId: 'webhook-id',
    eventDate: '2024-02-14T11:27:01.779Z',
    record: {
      id: 'record-id',
      name: 'New opportunity',
    },
  };

  it('captures webhook events and filters by object name', () => {
    const service = createService();

    service.captureWebhookEvent({ payload: samplePayload });
    service.captureWebhookEvent({
      payload: {
        ...samplePayload,
        eventName: 'person.created',
        objectMetadata: {
          id: 'person-metadata-id',
          nameSingular: 'person',
        },
      },
    });

    const opportunityEvents = service.listCapturedEvents({
      objectName: 'opportunity',
    });

    expect(opportunityEvents).toHaveLength(1);
    expect(opportunityEvents[0]?.payload.eventName).toBe('opportunity.created');
  });

  it('clears captured events', () => {
    const service = createService();

    service.captureWebhookEvent({ payload: samplePayload });
    service.clearCapturedEvents();

    expect(service.listCapturedEvents({})).toHaveLength(0);
  });

  it('allows viewing captured events outside production when view secret is unset', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'development';
    const service = createService();

    expect(service.canViewCapturedEvents(undefined)).toBe(true);

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('requires view secret in production when configured', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    process.env.NODE_ENV = 'production';
    const service = createService({
      TEST_WEBHOOK_VIEW_SECRET: 'view-secret',
    });

    expect(service.canViewCapturedEvents(undefined)).toBe(false);
    expect(service.canViewCapturedEvents('view-secret')).toBe(true);

    process.env.NODE_ENV = originalNodeEnv;
  });
});
