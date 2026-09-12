import { Test, type TestingModule } from '@nestjs/testing';

import { FeatureFlagKey } from 'twenty-shared/types';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { LinkedinProviderIdStoreService } from 'src/engine/core-modules/outreach-command/services/linkedin-provider-id.store';
import { FetchLinkedinActivityTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/fetch-linkedin-activity-tool';
import { createLinkedinUnipileMessagingServiceForTools } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util';

jest.mock(
  'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util',
  () => {
    const actual = jest.requireActual(
      'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/unipile-messaging-tool.util',
    );

    return {
      ...actual,
      createLinkedinUnipileMessagingServiceForTools: jest.fn(),
    };
  },
);

const VALID_PROVIDER_ID = 'ACoAAabcdefghij1234567890';

describe('FetchLinkedinActivityTool', () => {
  let tool: FetchLinkedinActivityTool;
  let resolveForSend: jest.Mock;
  let fetchLinkedinUserPosts: jest.Mock;
  let fetchLinkedinUserComments: jest.Mock;
  let isFeatureEnabled: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    resolveForSend = jest.fn().mockResolvedValue(VALID_PROVIDER_ID);
    fetchLinkedinUserPosts = jest.fn().mockResolvedValue({
      items: [
        {
          id: 'post-1',
          social_id: 'urn:li:activity:111',
          text: 'Shipped something cool',
          parsed_datetime: '2025-06-01T00:00:00.000Z',
          is_repost: false,
        },
      ],
    });
    fetchLinkedinUserComments = jest.fn().mockResolvedValue({ items: [] });
    isFeatureEnabled = jest.fn().mockResolvedValue(false);

    (
      createLinkedinUnipileMessagingServiceForTools as jest.Mock
    ).mockReturnValue({
      resolveProviderId: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchLinkedinActivityTool,
        {
          provide: LinkedinUnipileRequestService,
          useValue: { fetchLinkedinUserPosts, fetchLinkedinUserComments },
        },
        {
          provide: LinkedinProviderIdStoreService,
          useValue: { resolveForSend },
        },
        {
          provide: FeatureFlagService,
          useValue: { isFeatureEnabled },
        },
      ],
    }).compile();

    tool = module.get(FetchLinkedinActivityTool);
  });

  it('returns error when unipile account is missing', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: '',
        linkedinProfileId: 'jane-doe',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unipile account ID');
  });

  it('fetches posts and exposes mostRecentPost.socialId', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
        candidateId: 'cand-1',
        postsLimit: 5,
        includeUserComments: true,
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(fetchLinkedinUserPosts).toHaveBeenCalledWith(
      'acc-1',
      VALID_PROVIDER_ID,
      { limit: 5 },
    );
    expect(result.result).toEqual(
      expect.objectContaining({
        postsCount: 1,
        mostRecentPost: expect.objectContaining({
          socialId: 'urn:li:activity:111',
        }),
      }),
    );
  });

  it('returns mock payload when mock Unipile is enabled', async () => {
    isFeatureEnabled.mockImplementation(
      async (key: FeatureFlagKey) =>
        key === FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
    );

    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        linkedinProfileId: 'jane-doe',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(fetchLinkedinUserPosts).not.toHaveBeenCalled();
    expect(result.result).toEqual(
      expect.objectContaining({
        mock: true,
        postsCount: 1,
      }),
    );
  });
});
