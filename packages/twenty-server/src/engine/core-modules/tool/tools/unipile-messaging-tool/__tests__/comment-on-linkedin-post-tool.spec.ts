import { Test, type TestingModule } from '@nestjs/testing';

import { FeatureFlagKey } from 'twenty-shared/types';

import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { CommentOnLinkedinPostTool } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/comment-on-linkedin-post-tool';
import { OUTREACH_MOCK_UNIPILE_POST_COMMENT_RESPONSE_ID } from 'src/engine/core-modules/tool/tools/unipile-messaging-tool/utils/is-outreach-mock-unipile-enabled.util';

describe('CommentOnLinkedinPostTool', () => {
  let tool: CommentOnLinkedinPostTool;
  let commentOnLinkedinPost: jest.Mock;
  let isFeatureEnabled: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();

    commentOnLinkedinPost = jest.fn().mockResolvedValue({
      object: 'CommentSent',
      comment_id: 'comment-1',
    });
    isFeatureEnabled = jest.fn().mockResolvedValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentOnLinkedinPostTool,
        {
          provide: LinkedinUnipileRequestService,
          useValue: { commentOnLinkedinPost },
        },
        {
          provide: FeatureFlagService,
          useValue: { isFeatureEnabled },
        },
      ],
    }).compile();

    tool = module.get(CommentOnLinkedinPostTool);
  });

  it('returns error when postId is missing', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        postId: '',
        text: 'Great post',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('social_id');
  });

  it('comments via Unipile request service', async () => {
    const result = await tool.execute(
      {
        unipileAccountId: 'acc-1',
        postId: 'urn:li:activity:111',
        text: 'Sharp point.',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(commentOnLinkedinPost).toHaveBeenCalledWith(
      'acc-1',
      'urn:li:activity:111',
      'Sharp point.',
      { commentId: undefined },
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
        text: 'Sharp point.',
      },
      { workspaceId: 'ws-1' },
    );

    expect(result.success).toBe(true);
    expect(commentOnLinkedinPost).not.toHaveBeenCalled();
    expect(result.result).toEqual(
      expect.objectContaining({
        mock: true,
        response: expect.objectContaining({
          comment_id: OUTREACH_MOCK_UNIPILE_POST_COMMENT_RESPONSE_ID,
        }),
      }),
    );
  });
});
