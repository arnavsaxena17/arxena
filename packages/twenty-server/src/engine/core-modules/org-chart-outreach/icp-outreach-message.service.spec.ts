import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { LinkedinUnipileRequestService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-request.service';
import { LLMChatModelService } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.service';

import {
    IcpOutreachMessageService,
    pickMostRecentPost,
} from './icp-outreach-message.service';
import { filterPostsWithinDays } from './utils/linkedin-profile-context.util';

const ICP_FIXTURE = {
  industry: ['B2B SaaS', 'Fintech'],
  employee_range: '200-2000',
  tech_stack_signals: ['Kubernetes', 'Datadog'],
  buyer_titles: ['VP Engineering', 'Head of SRE'],
  pain_signals: ['on-call fatigue', 'high MTTR'],
};

const RANKED_CANDIDATES_FIXTURE = [
  {
    company_name: 'Acme Corp',
    chart_function: 'Platform Engineering',
    fit_reasoning: 'Runs Kubernetes + Datadog, 800 employees.',
  },
];

const daysAgoIso = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const TARGET_PROFILE_FIXTURE: Record<string, unknown> = {
  provider_id: 'ACoAAA-target',
  public_identifier: 'gaurav-sherlocks-ai',
  first_name: 'Gaurav',
  last_name: 'Toshniwal',
  headline: 'Co-founder @Sherlocks.ai',
};

const buildPostsPayload = (): Record<string, unknown> => ({
  items: [
    {
      id: 'post-recent',
      social_id: 'urn:li:activity:111',
      share_url: 'https://www.linkedin.com/posts/post-recent',
      text: 'We just shipped root-cause analysis for Kubernetes incidents.',
      parsed_datetime: daysAgoIso(5),
      is_repost: false,
    },
    {
      id: 'post-old',
      text: 'Throwback to our launch.',
      parsed_datetime: daysAgoIso(90),
      is_repost: false,
    },
    {
      id: 'post-repost',
      text: 'Sharing this great write-up.',
      parsed_datetime: daysAgoIso(2),
      is_repost: true,
    },
  ],
});

describe('IcpOutreachMessageService', () => {
  let service: IcpOutreachMessageService;
  const invoke = jest.fn();
  const fetchLinkedinUserProfile = jest.fn();
  const fetchLinkedinUserPosts = jest.fn();
  const fetchLinkedinPost = jest.fn();
  const commentOnLinkedinPost = jest.fn();
  const withOutreachLinkedinSession = jest.fn(
    async (
      _apiToken: string,
      _accountId: string | undefined,
      run: (session: { accountId: string }) => Promise<unknown>,
    ) => run({ accountId: 'unipile-account-1' }),
  );

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IcpOutreachMessageService,
        {
          provide: LLMChatModelService,
          useValue: { getJSONChatModel: () => ({ invoke }) },
        },
        {
          provide: LinkedinUnipileRequestService,
          useValue: {
            fetchLinkedinUserProfile,
            fetchLinkedinUserPosts,
            fetchLinkedinPost,
            commentOnLinkedinPost,
          },
        },
        {
          provide: LinkedinUnipileEstimateAccountService,
          useValue: { withOutreachLinkedinSession },
        },
      ],
    }).compile();

    service = module.get(IcpOutreachMessageService);
  });

  const baseAuth = {
    apiToken: 'tok',
    workspaceMemberId: 'wm-1',
    workspaceId: 'ws-1',
  };

  describe('post picking helpers', () => {
    it('filters posts to the given window', () => {
      const posts = [
        { text: 'new', parsedDatetime: daysAgoIso(3), isRepost: false },
        { text: 'old', parsedDatetime: daysAgoIso(45), isRepost: false },
        { text: 'undated', isRepost: false },
      ];
      const filtered = filterPostsWithinDays(posts, 30);
      console.log('filterPostsWithinDays result:', filtered);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].text).toBe('new');
    });

    it('picks the newest original post over a newer repost', () => {
      const picked = pickMostRecentPost([
        { text: 'repost', parsedDatetime: daysAgoIso(1), isRepost: true },
        { text: 'original', parsedDatetime: daysAgoIso(4), isRepost: false },
      ]);
      console.log('pickMostRecentPost result:', picked);
      expect(picked?.text).toBe('original');
    });

    it('falls back to a repost when there are no originals', () => {
      const picked = pickMostRecentPost([
        { text: 'repost', parsedDatetime: daysAgoIso(1), isRepost: true },
      ]);
      expect(picked?.text).toBe('repost');
      expect(pickMostRecentPost([])).toBeNull();
    });
  });

  describe('generateIcpMessage', () => {
    it('grounds the message in the ICP and the last-month post', async () => {
      fetchLinkedinUserProfile.mockResolvedValueOnce(TARGET_PROFILE_FIXTURE);
      fetchLinkedinUserPosts.mockResolvedValueOnce(buildPostsPayload());
      invoke.mockResolvedValueOnce({
        content: JSON.stringify({
          message: 'Saw your post on Kubernetes root-cause analysis...',
        }),
      });

      const result = await service.generateIcpMessage({
        icp: ICP_FIXTURE,
        sells: 'Agentic AI SRE platform',
        chartFunction: 'Engineering/Platform',
        targetIdentifier: 'gaurav-sherlocks-ai',
        messageType: 'connection_request',
        rankedCandidates: RANKED_CANDIDATES_FIXTURE,
        ...baseAuth,
      });
      console.log('generateIcpMessage result:', result);

      expect(result.message).toContain('Kubernetes');
      expect(result.recentPostUsed?.id).toBe('post-recent');
      expect(result.contextUsed).toEqual({
        targetPublicIdentifier: 'gaurav-sherlocks-ai',
        postsConsidered: 3,
        postsWithinWindow: 2,
        recentPostDays: 30,
        rankedCandidatesCount: 1,
      });

      const prompt = invoke.mock.calls[0][0] as string;
      console.log('generateIcpMessage prompt length:', prompt.length);
      expect(prompt).toContain('We just shipped root-cause analysis');
      expect(prompt).toContain('Acme Corp');
      expect(prompt).toContain('VP Engineering');
      expect(prompt).toContain('Agentic AI SRE platform');
    });

    it('reports no recent post when nothing falls within the window', async () => {
      fetchLinkedinUserProfile.mockResolvedValueOnce(TARGET_PROFILE_FIXTURE);
      fetchLinkedinUserPosts.mockResolvedValueOnce({
        items: [
          {
            id: 'post-old',
            text: 'Ancient news.',
            parsed_datetime: daysAgoIso(120),
            is_repost: false,
          },
        ],
      });
      invoke.mockResolvedValueOnce({
        content: JSON.stringify({ message: 'Hook on their selling motion.' }),
      });

      const result = await service.generateIcpMessage({
        icp: ICP_FIXTURE,
        targetIdentifier: 'gaurav-sherlocks-ai',
        messageType: 'message',
        ...baseAuth,
      });
      console.log('generateIcpMessage no-recent-post result:', result);

      expect(result.recentPostUsed).toBeNull();
      expect(result.contextUsed.postsWithinWindow).toBe(0);

      const prompt = invoke.mock.calls[0][0] as string;
      expect(prompt).toContain('No post in the last month');
    });

    it('re-prompts when the connection request exceeds 300 characters', async () => {
      fetchLinkedinUserProfile.mockResolvedValueOnce(TARGET_PROFILE_FIXTURE);
      fetchLinkedinUserPosts.mockResolvedValueOnce(buildPostsPayload());
      invoke
        .mockResolvedValueOnce({
          content: JSON.stringify({ message: 'x'.repeat(400) }),
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ message: 'Short enough now.' }),
        });

      const result = await service.generateIcpMessage({
        icp: ICP_FIXTURE,
        targetIdentifier: 'gaurav-sherlocks-ai',
        messageType: 'connection_request',
        ...baseAuth,
      });
      console.log('generateIcpMessage retry result length:', result.message.length);

      expect(invoke).toHaveBeenCalledTimes(2);
      expect(result.message).toBe('Short enough now.');
    });

    it('throws when targetIdentifier is missing', async () => {
      await expect(
        service.generateIcpMessage({
          icp: ICP_FIXTURE,
          targetIdentifier: '  ',
          messageType: 'message',
          ...baseAuth,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('generateIcpComment', () => {
    it('generates comments from provided post text without touching Unipile', async () => {
      invoke.mockResolvedValueOnce({
        content: JSON.stringify({
          comments: ['Sharp point on MTTR.', 'We saw the same in our data.'],
        }),
      });

      const result = await service.generateIcpComment({
        icp: ICP_FIXTURE,
        sells: 'Agentic AI SRE platform',
        postText: 'Alert fatigue is the silent killer of SRE teams.',
        rankedCandidates: RANKED_CANDIDATES_FIXTURE,
        variants: 2,
        ...baseAuth,
      });
      console.log('generateIcpComment provided-text result:', result);

      expect(result.comments).toHaveLength(2);
      expect(result.contextUsed.postSource).toBe('provided_text');
      expect(withOutreachLinkedinSession).not.toHaveBeenCalled();

      const prompt = invoke.mock.calls[0][0] as string;
      expect(prompt).toContain('Alert fatigue is the silent killer');
      expect(prompt).toContain('Acme Corp');
    });

    it('fetches the post by id when postId is given', async () => {
      fetchLinkedinPost.mockResolvedValueOnce({
        id: 'post-123',
        social_id: 'urn:li:activity:123',
        text: 'Kubernetes cost optimization thread.',
        parsed_datetime: daysAgoIso(3),
        is_repost: false,
      });
      invoke.mockResolvedValueOnce({
        content: JSON.stringify({ comments: ['Great thread.'] }),
      });

      const result = await service.generateIcpComment({
        icp: ICP_FIXTURE,
        postId: 'post-123',
        variants: 1,
        ...baseAuth,
      });
      console.log('generateIcpComment fetched-by-id result:', result);

      expect(fetchLinkedinPost).toHaveBeenCalledWith(
        'unipile-account-1',
        'post-123',
        expect.anything(),
      );
      expect(result.post.id).toBe('post-123');
      expect(result.contextUsed.postSource).toBe('fetched_by_id');
    });

    it("picks the author's latest post within the window when only personIdentifier is given", async () => {
      fetchLinkedinUserProfile.mockResolvedValueOnce(TARGET_PROFILE_FIXTURE);
      fetchLinkedinUserPosts.mockResolvedValueOnce(buildPostsPayload());
      invoke.mockResolvedValueOnce({
        content: JSON.stringify({ comments: ['Insightful.'] }),
      });

      const result = await service.generateIcpComment({
        icp: ICP_FIXTURE,
        personIdentifier: 'gaurav-sherlocks-ai',
        variants: 1,
        ...baseAuth,
      });
      console.log('generateIcpComment latest-from-person result:', result);

      expect(result.post.id).toBe('post-recent');
      expect(result.contextUsed.postSource).toBe('latest_from_person');
      expect(result.contextUsed.postsConsidered).toBe(3);
    });

    it('throws when no post input is provided', async () => {
      await expect(
        service.generateIcpComment({ icp: ICP_FIXTURE, ...baseAuth }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendPostComment', () => {
    it('publishes the comment through the resolved Unipile session', async () => {
      commentOnLinkedinPost.mockResolvedValueOnce({ object: 'PostComment' });

      const result = await service.sendPostComment({
        postId: 'urn:li:activity:111',
        text: 'Sharp point on MTTR.',
        ...baseAuth,
      });
      console.log('sendPostComment result:', result);

      expect(commentOnLinkedinPost).toHaveBeenCalledWith(
        'unipile-account-1',
        'urn:li:activity:111',
        'Sharp point on MTTR.',
        expect.objectContaining({ cleanupContext: expect.anything() }),
      );
      expect(result.success).toBe(true);
      expect(result.accountId).toBe('unipile-account-1');
    });

    it('throws when postId or text is missing', async () => {
      await expect(
        service.sendPostComment({ postId: ' ', text: 'hi', ...baseAuth }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.sendPostComment({ postId: 'p1', text: '  ', ...baseAuth }),
      ).rejects.toThrow(BadRequestException);
      expect(withOutreachLinkedinSession).not.toHaveBeenCalled();
    });
  });
});
