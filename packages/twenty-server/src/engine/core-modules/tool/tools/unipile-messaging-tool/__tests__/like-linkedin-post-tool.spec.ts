import { Test, type TestingModule } from '@nestjs/testing';

import { FeatureFlagKey } from 'twenty-shared/types';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { LikeLinkedinPostTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/like-linkedin-post-tool';
import { OUTREACH_MOCK_UNIPILE_POST_LIKE_RESPONSE_ID } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';

describe('LikeLinkedinPostTool', () => {
  let tool: LikeLinkedinPostTool;
  let reactToLinkedinPost: jest.Mock;
  let isFeatureEnabled: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    reactToLinkedinPost = jest.fn().mockResolvedValue({
      object: 'ReactionAdded',
    });
    isFeatureEnabled = jest.fn().mockResolvedValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikeLinkedinPostTool,
        {
          provide: LinkedinUnipileRequestService,
          useValue: { reactToLinkedinPost },
        },
        {
          provide: FeatureFlagService,
          useValue: { isFeatureEnabled },
        },
      ],
    }).compile();

    tool = module.get(LikeLinkedinPostTool);
  });

  it('returns error when postId is missing', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        postId: '',
        reactionType: 'like',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('social_id');
  });

  it('reacts via Unipile request service', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        postId: 'urn:li:activity:111',
        reactionType: 'celebrate',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(reactToLinkedinPost).toHaveBeenCalledWith(
      'acc-1',
      'urn:li:activity:111',
      {
        reactionType: 'celebrate',
        commentId: undefined,
      },
    );
  });

  it('returns mock response when mock Unipile is enabled', async () => {
    isFeatureEnabled.mockImplementation(
      async (key: FeatureFlagKey) =>
        key === FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED,
    );

    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        postId: 'urn:li:activity:111',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(reactToLinkedinPost).not.toHaveBeenCalled();
    expect(result.result).toEqual(
      expect.objectContaining({
        mock: true,
        response: expect.objectContaining({
          id: OUTREACH_MOCK_UNIPILE_POST_LIKE_RESPONSE_ID,
        }),
      }),
    );
  });
});
