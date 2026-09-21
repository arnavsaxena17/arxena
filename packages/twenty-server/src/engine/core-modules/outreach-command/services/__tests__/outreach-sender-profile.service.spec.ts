import { OutreachSenderProfileService } from 'src/engine/core-modules/outreach-command/services/outreach-sender-profile.service';
import { OUTREACH_BUILD_SENDER_PROFILE_SYSTEM_PROMPT } from 'src/engine/core-modules/outreach-command/prompts/outreach.prompts';
import { outreachSenderProfileLlmSchema } from 'src/engine/core-modules/outreach-command/schemas/outreach-sender-profile-llm.schema';
import { type OutreachSenderProfile } from 'src/engine/core-modules/outreach-command/types/outreach-sender-profile.type';

const buildService = () =>
  new OutreachSenderProfileService(
    {} as never,
    {} as never,
    undefined,
    undefined,
    {
      set: jest.fn(),
      get: jest.fn(),
    } as never,
  );

const minimalDraft = {
  targetTitles: ['CFO'],
  locations: ['India'],
  brief: 'Sender: Jane · CEO · Acme',
} satisfies OutreachSenderProfile;

describe('OutreachSenderProfileService.getBuildPrompt', () => {
  it('uses the slim sender profile system prompt', () => {
    const service = buildService();
    const prompt = service.getBuildPrompt({
      linkedinProfileText: 'Jane Doe\nCEO',
      collateralText: 'Pitch one-pager',
    });

    expect(prompt.system).toBe(OUTREACH_BUILD_SENDER_PROFILE_SYSTEM_PROMPT);
    expect(prompt.user).toContain('linkedin_profile: Jane Doe');
    expect(prompt.user).toContain('collateral: Pitch one-pager');
  });
});

describe('outreachSenderProfileLlmSchema', () => {
  it('parses slim drafts', () => {
    const parsed = outreachSenderProfileLlmSchema.parse(minimalDraft);

    expect(parsed.targetTitles).toEqual(['CFO']);
    expect(parsed.brief).toContain('Jane');
  });
});

describe('OutreachSenderProfileService generate jobs', () => {
  it('enqueues a generate job id', async () => {
    const store = new Map<string, unknown>();
    const cache = {
      set: jest.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      get: jest.fn(async (key: string) => store.get(key)),
    };
    const service = new OutreachSenderProfileService(
      {} as never,
      {} as never,
      undefined,
      undefined,
      cache as never,
    );

    jest.spyOn(service, 'generateSenderProfile').mockResolvedValue({
      draft: minimalDraft,
      prompt: { system: 's', user: 'u' },
      linkedinProfileText: 'Jane Doe',
      existingSenderProfile: null,
    });
    jest.spyOn(service, 'saveSenderProfile').mockResolvedValue({
      profileId: 'member-1',
      outreachSenderProfile: minimalDraft,
    });

    const { draftJobId } = await service.enqueueGenerateSenderProfile({
      workspaceId: 'ws-1',
      workspaceMemberId: 'member-1',
      linkedinProfileText: 'Jane Doe',
    });

    expect(draftJobId).toBeTruthy();
    await service.getGenerateSenderProfileJob({
      draftJobId,
      workspaceId: 'ws-1',
      workspaceMemberId: 'member-1',
    });
  });

  it('stamps a seed sender profile without LinkedIn', async () => {
    const service = buildService();

    jest
      .spyOn(service as never, 'resolveBootstrapWorkspaceMember' as never)
      .mockResolvedValue({
        id: 'member-1',
        name: { firstName: 'Jane', lastName: 'Doe' },
        jobTitle: 'CEO',
        outreachSenderProfile: null,
        linkedinProfile: null,
      } as never);

    const saveSpy = jest.spyOn(service, 'saveSenderProfile').mockResolvedValue({
      profileId: 'member-1',
      outreachSenderProfile: minimalDraft,
    });

    const stamped = await service.stampSenderProfileFromWorkspaceBootstrap({
      workspaceId: 'ws-1',
      companyName: 'Acme',
      companyDomain: 'acme.com',
      industry: 'SaaS',
      summary: 'We sell widgets',
      targetTitles: ['CFO'],
      locations: ['US'],
    });

    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        senderProfile: expect.objectContaining({
          targetTitles: ['CFO'],
          locations: ['US'],
          brief: expect.stringContaining('Jane'),
        }),
      }),
    );
    expect(stamped).toEqual(minimalDraft);
  });
});
