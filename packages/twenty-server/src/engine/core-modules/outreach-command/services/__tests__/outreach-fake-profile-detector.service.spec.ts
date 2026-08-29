import { generateObject } from 'ai';

import { OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID } from 'src/engine/core-modules/outreach-command/constants/outreach-company-enrichment-model.const';
import { OutreachFakeProfileDetectorService } from 'src/engine/core-modules/outreach-command/services/outreach-fake-profile-detector.service';
import type { AiModelRegistryService } from 'src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';

jest.mock('ai', () => ({
  generateObject: jest.fn(),
}));

const generateObjectMock = generateObject as jest.MockedFunction<
  typeof generateObject
>;

const FAKE_PROFILE = {
  object: 'LinkedinProfile',
  firstName: 'TS',
  lastName: 'Dadapeer',
  headline: 'Change',
  location: 'India',
  publicIdentifier: 'syed-dadapeer5410',
  summary:
    'Egon Zehnder is a leading global high-end headhunting and leadership consulting firm founded in 1964.',
  education: [
    {
      degreeName: 'Bachelor of Business Administration - BBA',
      schoolName: 'Osmania University, Hyderabad',
      start: '7/1/2019',
      end: '12/1/2023',
    },
  ],
  experience: [
    {
      company: 'Egon Zehnder',
      title: 'Senior Consultant',
      employmentType: 'Self-employed',
      location: '35-36 Brook Street London',
      start: '6/1/2013',
    },
  ],
};

describe('OutreachFakeProfileDetectorService', () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it('returns an error when no profiles are provided', async () => {
    const detector = new OutreachFakeProfileDetectorService(undefined);

    await expect(detector.execute({ input: {} })).resolves.toMatchObject({
      success: false,
      total: 0,
      error: expect.stringContaining('profile'),
    });
  });

  it('assesses a profile with hy3:free and returns fake hits', async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        verdict: 'fake',
        confidence: 0.94,
        riskScore: 91,
        summary:
          'BBA through 2023 cannot precede an Egon Zehnder role from 2013; the role is self-employed.',
        redFlags: [
          'Education 2019-2023 vs Egon Zehnder from 2013',
          'Self-employed at Egon Zehnder',
        ],
        supportingSignals: ['Profile has a photo and 1000+ connections'],
      },
    } as Awaited<ReturnType<typeof generateObject>>);

    const defaultFastModel = {
      modelId: OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID,
      model: { provider: 'mock' },
    };

    const aiModelRegistryService = {
      getDefaultSpeedModel: jest.fn().mockReturnValue(defaultFastModel),
      getModel: jest.fn().mockReturnValue(defaultFastModel),
      resolveModelForAgentInWorkspace: jest.fn(),
    } as unknown as AiModelRegistryService;

    const detector = new OutreachFakeProfileDetectorService(aiModelRegistryService);

    const result = await detector.execute({
      input: { profile: FAKE_PROFILE },
    });

    expect(aiModelRegistryService.getModel).toHaveBeenCalledWith(
      OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID,
    );
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    expect(generateObjectMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        model: { provider: 'mock' },
        system: expect.stringContaining('investigative analyst'),
        prompt: expect.stringContaining('Chronology clash'),
      }),
    );
    expect(generateObjectMock.mock.calls[0][0].prompt).toContain(
      'Egon Zehnder',
    );
    expect(result.success).toBe(true);
    expect(result.fakeCount).toBe(1);
    expect(result.fakeProfiles[0]?.isLikelyFake).toBe(true);
    expect(result.fakeProfiles[0]?.verdict).toBe('fake');
    expect(result.fakeProfiles[0]?.publicIdentifier).toBe(
      'syed-dadapeer5410',
    );
  });

  it('screens an array and keeps genuine profiles out of fakeProfiles', async () => {
    generateObjectMock
      .mockResolvedValueOnce({
        object: {
          verdict: 'fake',
          confidence: 0.9,
          riskScore: 80,
          summary: 'Fake',
          redFlags: ['dates'],
          supportingSignals: [],
        },
      } as Awaited<ReturnType<typeof generateObject>>)
      .mockResolvedValueOnce({
        object: {
          verdict: 'likely_genuine',
          confidence: 0.7,
          riskScore: 20,
          summary: 'Coherent partner bio',
          redFlags: [],
          supportingSignals: ['Long tenure, specific practice language'],
        },
      } as Awaited<ReturnType<typeof generateObject>>);

    const aiModelRegistryService = {
      getDefaultSpeedModel: jest.fn(),
      getModel: jest.fn().mockReturnValue({
        modelId: OUTREACH_COMPANY_ENRICHMENT_LLM_MODEL_ID,
        model: { provider: 'mock' },
      }),
      resolveModelForAgentInWorkspace: jest.fn(),
    } as unknown as AiModelRegistryService;

    const detector = new OutreachFakeProfileDetectorService(aiModelRegistryService);

    const result = await detector.execute({
      input: {
        profiles: [
          FAKE_PROFILE,
          {
            firstName: 'Gizem',
            lastName: 'Ozkulahci Weggemans',
            headline: 'Partner - Board, CEO, CHRO',
            location: 'London, England, United Kingdom',
          },
        ],
      },
    });

    expect(result.total).toBe(2);
    expect(result.fakeCount).toBe(1);
    expect(result.genuineCount).toBe(1);
    expect(result.fakeProfiles).toHaveLength(1);
    expect(result.genuineProfiles[0]?.name).toContain('Gizem');
  });
});
