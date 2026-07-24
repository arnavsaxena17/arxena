import { SearchModelsService } from '../services/search-models.service';
import {
  CandidateStructuredFields,
  SearchStrategyPlan,
  StrategyRubricEvaluation,
} from '../types/search-models.types';

const mockCompletionCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCompletionCreate,
      },
    },
  }));
});

const buildStructuredFields = (): CandidateStructuredFields => ({
  jsUserName: 'Richa Sikaria',
  jobTitle: 'Vice President - Corporate Accounting',
  keySkills: 'Management,Accounting,Marketing,MS Office,Excel',
  focusedSkills:
    'Auditing, IFRS, US GAAP, US Audit, GAAP Conversion, Variance Analysis, Statutory Audit, Finance, Internal Audit, IGAAP',
  interestedSkills: '',
  education: {
    ug: {
      institute: 'Delhi University - Other',
      course: 'B.Com',
      specialization: 'Commerce',
      year: 2004,
    },
    pg: {
      institute: 'Institute of Chartered Accountants of India',
      course: 'CA',
      specialization: 'CA',
      year: 2006,
    },
    ppg: null,
  },
  employment: {
    current: {
      designation: 'Vice President',
      organization: 'J P Morgan Chase & Co',
      startDate: '2017-04-01',
      endDate: '',
    },
    previous: {
      designation: 'Senior Manager',
      organization: 'Exlservice.Com',
      startDate: '2011-03-01',
      endDate: '2017-03-01',
    },
  },
  ctcInfo: {
    lacs: '56+',
    thousands: null,
    currency: 'INR',
  },
  experience: {
    years: 17,
    months: 0,
  },
  currentLocation: 'Mumbai',
  preferredLocations: 'Mumbai',
  salaryDisclosed: true,
  immediateAvailabilty: false,
  avgResponseTime: null,
  noticePeriod: 3,
  modifyDateLabel: 'Modified in last 1 year',
  activeDateLabel: 'Active in last 1 year',
});

const buildRubric = (strategyName: string): StrategyRubricEvaluation => ({
  strategyName,
  fitSummary: `${strategyName} fit summary`,
  rubric: [
    {
      field: 'jobTitle',
      value: 'Vice President',
      guidance: 'Ensure strategic scope',
      status: 'aligned',
      rationale: 'Matches leadership expectations',
    },
  ],
  recommendedAction: 'Proceed',
  riskNotes: 'None',
});

describe('SearchModelsService rubric workflow', () => {
  let service: SearchModelsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SearchModelsService();
  });

  it('takes the candidate, executes runPrompt stages, and forwards parsed completions to subsequent steps', async () => {
    const candidateProfile = {
      name: 'Richa Sikaria',
      structuredFields: buildStructuredFields(),
    };

    const informationPlan = {
      summary: 'Initial info plan',
      missingInformation: [],
    };

    const strategyPlan: SearchStrategyPlan = {
      strategies: [
        {
          name: 'Strategy A',
          description: 'Focus on manufacturing conglomerates',
          triggers: ['JD requires manufacturing experience'],
          riskLevel: 'low',
          steps: ['Filter by Mumbai'],
          targetPoolSize: '20-30',
        },
        {
          name: 'Strategy B',
          description: 'Scout polymer specialists',
          triggers: ['Need polymer investments experience'],
          riskLevel: 'medium',
          steps: ['Source from global insulator OEMs'],
          targetPoolSize: '15-25',
        },
      ],
      recommendedNextActions: [],
    };

    const mockRunResults = strategyPlan.strategies.map((strategy) =>
      buildRubric(strategy.name),
    );

    const buildCompletionResponse = (payload: unknown) => ({
      choices: [
        {
          message: {
            content: JSON.stringify(payload),
          },
        },
      ],
    });

    mockCompletionCreate
      .mockResolvedValueOnce(buildCompletionResponse(informationPlan))
      .mockResolvedValueOnce(buildCompletionResponse(strategyPlan))
      .mockResolvedValueOnce(buildCompletionResponse(mockRunResults[0]))
      .mockResolvedValueOnce(buildCompletionResponse(mockRunResults[1]));

    const runPromptSpy = jest.spyOn(service as any, 'runPrompt');

    const result = await service.evaluateStrategyRubrics({
      naturalLanguageQuery: 'Head of Corporate Strategy',
      candidate: {
        name: candidateProfile.name,
        structuredFields: candidateProfile.structuredFields,
      } as any,
    });

    expect(runPromptSpy).toHaveBeenCalledTimes(
      strategyPlan.strategies.length + 2,
    );
    expect(runPromptSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ stage: 'information-plan' }),
    );
    expect(runPromptSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ stage: 'strategy-plan' }),
    );
    expect(runPromptSpy).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ stage: 'strategy-rubric-0' }),
    );
    expect(runPromptSpy).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ stage: 'strategy-rubric-1' }),
    );
    expect(mockCompletionCreate).toHaveBeenCalledTimes(
      strategyPlan.strategies.length + 2,
    );
    expect(mockCompletionCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' }),
        ]),
      }),
    );
    expect(result.strategyRubricEvaluations).toEqual([
      expect.objectContaining({ strategyName: 'Strategy A' }),
      expect.objectContaining({ strategyName: 'Strategy B' }),
    ]);
    expect(result.searchStrategyPlan).toEqual(strategyPlan);
  });
});

