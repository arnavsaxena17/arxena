import { FeatureFlagKey } from 'twenty-shared/types';

import { FetchUserCommentsService } from '../fetch-user-comments.service';

describe('FetchUserCommentsService', () => {
  const executeInWorkspaceContext = jest.fn(
    async <T>(callback: () => Promise<T>) => callback(),
  );
  const getRepository = jest.fn();
  const fetchLinkedinUserComments = jest.fn();
  const isFeatureEnabled = jest.fn();

  const service = new FetchUserCommentsService(
    {
      executeInWorkspaceContext,
      getRepository,
    } as never,
    { fetchLinkedinUserComments } as never,
    { isFeatureEnabled } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    isFeatureEnabled.mockResolvedValue(false);
    getRepository.mockResolvedValue({
      findOne: jest.fn().mockResolvedValue({
        linkedinUnipileAccountId: 'acc_123',
        workspaceMemberId: 'member-1',
      }),
      find: jest.fn().mockResolvedValue([
        {
          linkedinUnipileAccountId: 'acc_123',
          workspaceMemberId: 'member-1',
        },
      ]),
    });
  });

  it('returns mock comments when outreach mock Unipile is enabled', async () => {
    isFeatureEnabled.mockImplementation(async (key: FeatureFlagKey) => {
      return key === FeatureFlagKey.IS_OUTREACH_MOCK_UNIPILE_ENABLED;
    });

    const result = await service.execute({
      workspaceId: 'workspace-1',
      input: { userId: 'me', limit: 10 },
    });

    expect(result.success).toBe(true);
    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].id).toBe('mock-comment-1');
    expect(fetchLinkedinUserComments).not.toHaveBeenCalled();
  });

  it('fetches and maps Unipile user comments across pages', async () => {
    fetchLinkedinUserComments
      .mockResolvedValueOnce({
        data: [
          {
            id: 'comment-1',
            text: 'First',
            created_at: '2026-08-01T00:00:00.000Z',
            reply_counter: 2,
            author: {
              display_name: 'Jane Doe',
              profile_url: 'https://www.linkedin.com/in/jane-doe',
            },
            parent_post: {
              id: 'post-1',
              share_url: 'https://www.linkedin.com/feed/update/1',
              text: 'Parent post',
            },
          },
        ],
        total_count: 2,
        next_cursor: 'cursor-2',
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'comment-2',
            text: 'Second',
            created_at: '2026-08-02T00:00:00.000Z',
            author: { display_name: 'Jane Doe' },
            parent_post: { id: 'post-2', text: 'Another post' },
          },
        ],
        total_count: 2,
        next_cursor: null,
      });

    const result = await service.execute({
      workspaceId: 'workspace-1',
      input: {
        workspaceMemberId: 'member-1',
        linkedinProfileId: 'jane-doe',
        limit: 50,
      },
    });

    expect(result.success).toBe(true);
    expect(result.total).toBe(2);
    expect(result.comments).toEqual([
      {
        id: 'comment-1',
        text: 'First',
        createdAt: '2026-08-01T00:00:00.000Z',
        threadId: '',
        replyCounter: 2,
        authorName: 'Jane Doe',
        authorUrl: 'https://www.linkedin.com/in/jane-doe',
        parentPostId: 'post-1',
        parentPostUrl: 'https://www.linkedin.com/feed/update/1',
        parentPostText: 'Parent post',
      },
      {
        id: 'comment-2',
        text: 'Second',
        createdAt: '2026-08-02T00:00:00.000Z',
        threadId: '',
        replyCounter: 0,
        authorName: 'Jane Doe',
        authorUrl: '',
        parentPostId: 'post-2',
        parentPostUrl: '',
        parentPostText: 'Another post',
      },
    ]);
    expect(fetchLinkedinUserComments).toHaveBeenCalledTimes(2);
    expect(fetchLinkedinUserComments).toHaveBeenNthCalledWith(
      1,
      'acc_123',
      'jane-doe',
      { limit: 50, cursor: undefined },
    );
    expect(fetchLinkedinUserComments).toHaveBeenNthCalledWith(
      2,
      'acc_123',
      'jane-doe',
      { limit: 49, cursor: 'cursor-2' },
    );
  });

  it('returns an error when no LinkedIn identifier is provided', async () => {
    const result = await service.execute({
      workspaceId: 'workspace-1',
      input: { workspaceMemberId: 'member-1' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
    expect(fetchLinkedinUserComments).not.toHaveBeenCalled();
  });
});
