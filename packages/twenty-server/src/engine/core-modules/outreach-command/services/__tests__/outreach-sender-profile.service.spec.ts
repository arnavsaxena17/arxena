import { type CacheStorageService } from 'src/engine/core-modules/cache-storage/services/cache-storage.service';
import { OUTREACH_BUILD_SENDER_PROFILE_SYSTEM_PROMPT } from 'src/engine/core-modules/outreach-command/prompts/outreach.prompts';
import { outreachSenderProfileLlmSchema } from 'src/engine/core-modules/outreach-command/schemas/outreach-sender-profile-llm.schema';
import {
  type OutreachSenderProfileDraftJob,
  OutreachSenderProfileService,
} from 'src/engine/core-modules/outreach-command/services/outreach-sender-profile.service';
import { type OutreachSenderProfile } from 'src/engine/core-modules/outreach-command/types/outreach-sender-profile.type';

const createService = (cache: CacheStorageService) =>
  new OutreachSenderProfileService(
    {} as never,
    {} as never,
    {
      update: jest.fn().mockResolvedValue(undefined),
    } as never,
    undefined,
    undefined,
    cache,
  );

const minimalDraft = {
  id: 'sender-1',
  identity: {
    full_name: 'Jane Doe',
    first_name: 'Jane',
    how_they_sign: 'Jane',
    title: 'CEO',
    company: 'Acme',
    company_short: 'Acme',
    website: null,
    phone: null,
    email: null,
    linkedin_url: null,
    city: null,
    timezone: null,
  },
  credibility: {
    one_liner: 'Operator',
    operator_line: 'Ran factories',
    credentials: [],
    years_experience: 10,
    industries_known: ['manufacturing'],
    shared_background_tags: [],
  },
  offer: {
    product_name: 'Acme Ops',
    category: 'ops',
    one_sentence: 'Books factory demos',
    problem_statements: [],
    outcomes: [],
    proof_points: [],
    works_with: [],
    implementation_time: null,
    pilot_offer: null,
    pricing_line: null,
    data_security_line: null,
    faq: [],
    collateral: [],
  },
  icp: {
    target_roles: ['Plant Head'],
    target_company_profile: null,
    revenue_band: null,
    geography: ['India'],
    exclude_roles: [],
    exclude_company_types: [],
    known_objections: [],
  },
  voice: {
    register: 'direct',
    formality: 'professional',
    uses_honorifics: false,
    signature_phrases: [],
    avoid_phrases: [],
    sign_off: 'Regards, Jane',
  },
  meeting: {
    default_duration_min: 20,
    platform: 'teams',
    agenda_template: 'Intro',
    preferred_windows: [],
    allow_weekends_if_proposed: true,
  },
  review_flags: ['offer.pricing_line'],
} satisfies OutreachSenderProfile;

describe('OutreachSenderProfileService.getBuildPrompt', () => {
  it('should include system prompt and input sections', () => {
    const service = createService({} as never);
    const prompt = service.getBuildPrompt({
      linkedinProfileText: 'Jane Doe\nCEO',
      collateralText: 'Pitch one-pager',
      senderNotes: 'Focus on factories',
      existingObject: null,
    });

    expect(prompt.system).toBe(OUTREACH_BUILD_SENDER_PROFILE_SYSTEM_PROMPT);
    expect(prompt.user).toContain('linkedin_profile: Jane Doe');
    expect(prompt.user).toContain('collateral: Pitch one-pager');
    expect(prompt.user).toContain('sender_notes: Focus on factories');
  });
});

describe('OutreachSenderProfileService draft jobs', () => {
  const createCache = () => {
    const store = new Map<string, OutreachSenderProfileDraftJob>();

    return {
      cache: {
        get: jest.fn(async (key: string) => store.get(key)),
        set: jest.fn(
          async (key: string, value: OutreachSenderProfileDraftJob) => {
            store.set(key, value);
          },
        ),
      } as unknown as CacheStorageService,
    };
  };

  it('writes pending then ready, saves draft to seat, and rejects wrong member ownership', async () => {
    const { cache } = createCache();
    const service = createService(cache);

    let resolveDraft!: (value: {
      draft: OutreachSenderProfile;
      prompt: { system: string; user: string };
      linkedinProfileText: string;
      existingSenderProfile: null;
    }) => void;

    const draftPromise = new Promise<{
      draft: OutreachSenderProfile;
      prompt: { system: string; user: string };
      linkedinProfileText: string;
      existingSenderProfile: null;
    }>((resolve) => {
      resolveDraft = resolve;
    });

    jest
      .spyOn(service, 'draftSenderProfile')
      .mockReturnValue(draftPromise as never);

    const saveSpy = jest.spyOn(service, 'saveSenderProfile').mockResolvedValue({
      profileId: 'member-1',
      outreachSenderProfile: minimalDraft,
    });

    const { draftJobId } = await service.enqueueDraftSenderProfile({
      workspaceId: 'ws-1',
      workspaceMemberId: 'member-1',
      linkedinProfileText: 'Jane Doe',
    });

    await expect(
      service.getDraftSenderProfileJob({
        draftJobId,
        workspaceId: 'ws-1',
        workspaceMemberId: 'member-other',
      }),
    ).rejects.toThrow('Draft job not found or expired');

    const pending = await service.getDraftSenderProfileJob({
      draftJobId,
      workspaceId: 'ws-1',
      workspaceMemberId: 'member-1',
    });

    expect(pending.status).toBe('pending');

    resolveDraft({
      draft: minimalDraft,
      prompt: { system: 'system', user: 'user' },
      linkedinProfileText: 'Jane Doe',
      existingSenderProfile: null,
    });
    await draftPromise;
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const ready = await service.getDraftSenderProfileJob({
      draftJobId,
      workspaceId: 'ws-1',
      workspaceMemberId: 'member-1',
    });

    expect(ready.status).toBe('ready');
    expect(ready.draft).toEqual(minimalDraft);
    expect(ready.linkedinProfileText).toBe('Jane Doe');
    expect(saveSpy).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      workspaceMemberId: 'member-1',
      senderProfile: minimalDraft,
    });
  });

  it('stamps a seed sender profile without LinkedIn', async () => {
    const { cache } = createCache();
    const service = createService(cache);

    jest
      .spyOn(service as never, 'resolveBootstrapWorkspaceMember')
      .mockResolvedValue({
        id: 'member-1',
        name: { firstName: 'Jane', lastName: 'Doe' },
        userEmail: 'jane@acme.com',
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
      industry: 'Manufacturing',
      summary: 'Makes widgets',
      hq: 'Pune',
      icpSpec: {
        targetTitles: ['Head of Talent'],
        locations: ['India'],
      },
      force: true,
    });

    expect(stamped).toEqual(minimalDraft);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        workspaceMemberId: 'member-1',
        skipWorkspaceIcpSync: true,
        senderProfile: expect.objectContaining({
          identity: expect.objectContaining({
            company: 'Acme',
            website: 'https://acme.com',
          }),
          icp: expect.objectContaining({
            target_roles: ['Head of Talent'],
            geography: ['India'],
          }),
        }),
      }),
    );
  });
});

describe('outreachSenderProfileLlmSchema', () => {
  it('should parse a minimal valid sender profile', () => {
    const parsed = outreachSenderProfileLlmSchema.parse(minimalDraft);

    expect(parsed.identity.first_name).toBe('Jane');
    expect(parsed.review_flags).toEqual(['offer.pricing_line']);
  });
});
