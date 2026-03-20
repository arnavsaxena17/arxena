import type { OrchestratorResult } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

jest.mock(
  'src/engine/core-modules/candidate-search/services/result-validation.service',
  () => ({
    ResultValidationService: class ResultValidationService {},
  }),
);

jest.mock(
  'src/engine/core-modules/candidate-search/services/candidate-search-base.service',
  () => ({
    CandidateSearchBaseService: class CandidateSearchBaseService {},
  }),
);

import { IterativeLinkedinQueryGenerationService } from '../services/iterative-linkedin-query-generation.service';

describe('IterativeLinkedinQueryGenerationService', () => {
  let service: IterativeLinkedinQueryGenerationService;
  let generator: {
    generateSearchQuerySet: jest.Mock;
    validateQuerySet: jest.Mock;
  };
  let candidateSearchBaseService: {
    getLinkedInAccountId: jest.Mock;
    resolveSearchParameters: jest.Mock;
    executeLinkedInSearch: jest.Mock;
  };
  let resultValidationService: {
    validateResultsAgainstQuery: jest.Mock;
  };

  const seedResult: OrchestratorResult = {
    parsed_requirement: {
      original_requirement: 'Find revenue operations leaders',
      query_type: 'C',
      query_type_description: 'mixed',
      domain_expertise: ['revenue operations'],
      technical_skills: [],
      industry_terms: ['saas'],
      certifications: [],
      target_companies: ['Acme'],
      location: ['bangalore'],
      precision_vs_recall: 'balanced',
    },
    master_lists: {
      keywords: {
        all_terms: ['revenue operations', 'revops', 'sales operations'],
        grouped_concepts: {
          revops: ['revenue operations', 'revops', 'sales operations'],
        },
        selected_terms: ['revenue operations', 'revops', 'sales operations'],
        term_count: 3,
      },
      job_titles: {
        all_terms: ['Head of Revenue Operations', 'Director RevOps'],
        by_seniority: {
          junior: null,
          mid: null,
          senior: ['Head of Revenue Operations', 'Director RevOps'],
          cxo: null,
        },
        selected_terms: ['Head of Revenue Operations', 'Director RevOps'],
        term_count: 2,
      },
      companies: {
        all_companies: ['Acme'],
        use_company_filter: true,
        reasoning: 'Seed example',
        alternative_keywords: null,
        clusters: null,
      },
    },
    primary_query: {
      query: {
        keywords: '"revenue operations" OR revops OR "sales operations"',
        job_title: '"Head of Revenue Operations" OR "Director RevOps"',
        company: ['Acme'],
        location: ['Bangalore'],
        years_of_experience: null,
      },
      term_counts: {
        keywords: 3,
        job_title: 2,
        combined: 5,
      },
      needs_splitting: false,
      recommended_strategy: 'A',
    },
    factored_query: {
      factored_query: {
        keywords: '"revenue operations" OR revops OR "sales operations"',
        job_title: '"Head of Revenue Operations" OR "Director RevOps"',
        company: ['Acme'],
        location: ['Bangalore'],
        years_of_experience: null,
      },
      term_counts: {
        keywords: 3,
        job_title: 2,
        combined: 5,
      },
      needs_splitting: false,
      recommended_strategy: 'A',
    },
    splitting_strategy: {
      strategy_type: 'A',
      strategy_description: 'none',
      number_of_queries: 1,
      distribution_logic: 'single query',
    },
    final_query_set: {
      search_query_set: [
        {
          keywords: '"revenue operations" OR revops OR "sales operations"',
          job_title: '"Head of Revenue Operations" OR "Director RevOps"',
          company: ['Acme'],
          location: ['Bangalore'],
          years_of_experience: null,
        },
      ],
    },
    metadata: {
      processing_time_ms: 10,
      agent1_time_ms: 1,
      agent2_time_ms: 1,
      agent3_time_ms: 1,
      agent4_time_ms: 1,
      total_queries_generated: 1,
    },
  };

  beforeEach(() => {
    generator = {
      generateSearchQuerySet: jest.fn().mockResolvedValue(seedResult),
      validateQuerySet: jest.fn().mockImplementation((querySet) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        querySet.search_query_set.forEach((query, index) => {
          if (!query.keywords && !query.job_title) {
            errors.push(`Query ${index + 1}: keywords and job_title are both null`);
          }
        });

        return {
          valid: errors.length === 0,
          errors,
          warnings,
        };
      }),
    };

    candidateSearchBaseService = {
      getLinkedInAccountId: jest.fn(),
      resolveSearchParameters: jest.fn(),
      executeLinkedInSearch: jest.fn(),
    };

    resultValidationService = {
      validateResultsAgainstQuery: jest.fn(),
    };

    service = new IterativeLinkedinQueryGenerationService(
      generator as any,
      candidateSearchBaseService as any,
      resultValidationService as any,
    );

    jest
      .spyOn(service as any, 'callLlm')
      .mockImplementation(
        async (
          _systemPrompt: string,
          userPrompt: string,
          _options: unknown,
          schemaOption: { name: string },
        ) => {
          if (schemaOption.name === 'iterativeTargetProfiles') {
            return {
              positive_profiles: [
                {
                  archetype: 'Revenue operations leader',
                  must_have_signals: ['revenue operations', 'forecasting'],
                  optional_signals: ['pipeline analytics'],
                  likely_titles: ['Head of Revenue Operations', 'Director RevOps'],
                  likely_keywords: ['revenue operations', 'sales operations'],
                  rationale: 'Core target',
                },
                {
                  archetype: 'Sales operations leader',
                  must_have_signals: ['sales operations'],
                  optional_signals: ['planning'],
                  likely_titles: ['Director Sales Operations'],
                  likely_keywords: ['sales operations', 'go-to-market'],
                  rationale: 'Adjacent target',
                },
                {
                  archetype: 'Go-to-market operations lead',
                  must_have_signals: ['revops'],
                  optional_signals: ['funnel analytics'],
                  likely_titles: ['GTM Operations Lead'],
                  likely_keywords: ['revops', 'pipeline management'],
                  rationale: 'Broad recall target',
                },
              ],
              negative_profiles: [
                {
                  archetype: 'Pure sales leader',
                  must_have_signals: ['sales leadership'],
                  optional_signals: [],
                  likely_titles: ['VP Sales'],
                  likely_keywords: ['quota carrying'],
                  rationale: 'Too commercial',
                },
                {
                  archetype: 'CRM administrator',
                  must_have_signals: ['crm admin'],
                  optional_signals: [],
                  likely_titles: ['Salesforce Admin'],
                  likely_keywords: ['administrator'],
                  rationale: 'Too junior',
                },
              ],
              retrieval_principles: [
                'Prefer title-only and keyword-only variants when overlap is high',
                'Do not over-anchor on example companies',
                'Surface people with operations keywords anywhere in profile',
              ],
            };
          }

          if (schemaOption.name === 'iterativeQueryVerification') {
            const isMixed =
              userPrompt.includes('"Head of Revenue Operations" OR "Director RevOps"') &&
              userPrompt.includes('"revenue operations" OR revops OR "sales operations"');
            const isSplit =
              userPrompt.includes('"Head of Revenue Operations" OR "Director RevOps"') &&
              userPrompt.includes('"job_title": null');

            return {
              valid: true,
              score: isMixed ? 0.42 : isSplit ? 0.86 : 0.72,
              overlap_score: isMixed ? 0.72 : 0.18,
              breadth_score: isMixed ? 0.35 : 0.82,
              constraint_load_score: isMixed ? 0.3 : 0.78,
              role_signal_score: isMixed ? 0.6 : 0.82,
              expected_candidate_volume_score: isMixed ? 0.32 : 0.8,
              live_preview_score: userPrompt.includes('"preview_score"') ? 0.8 : null,
              relevance_score: userPrompt.includes('"preview_score"') ? 0.9 : null,
              findings: isMixed
                ? [
                    {
                      code: 'overlapping_title_keywords',
                      severity: 'warning',
                      message: 'Title and keywords overlap too much.',
                    },
                  ]
                : [],
              recommended_actions: isMixed
                ? ['split_mixed_query', 'drop_keywords']
                : ['preserve_location'],
              summary: isMixed
                ? 'Mixed query is too narrow.'
                : 'Split query family has good recall.',
            };
          }

          if (schemaOption.name === 'iterativeQueryRefiner') {
            return {
              refined_query_set: {
                search_query_set: [
                  {
                    keywords: null,
                    job_title: '"Head of Revenue Operations" OR "Director RevOps"',
                    company: ['Acme'],
                    location: ['Bangalore'],
                    years_of_experience: null,
                  },
                  {
                    keywords: '"revenue operations" OR revops OR "sales operations"',
                    job_title: null,
                    company: null,
                    location: ['Bangalore'],
                    years_of_experience: null,
                  },
                ],
              },
              rationale: 'Split title and keyword families for better recall.',
              changes_made: [
                'Separated title-heavy and keyword-heavy queries',
                'Relaxed company filter on keyword-heavy query',
              ],
            };
          }

          throw new Error(`Unexpected schema call: ${schemaOption.name}`);
        },
      );
  });

  it('prefers broader split variants when title and keywords overlap heavily', async () => {
    const result = await service.generateIterativeSearchQuerySet(
      'Find revenue operations leaders',
      {
        mode: 'offline',
      },
    );

    expect(result.final_query_set.search_query_set.length).toBeGreaterThan(1);
    expect(
      result.final_query_set.search_query_set.every(
        (query) => !(query.job_title && query.keywords),
      ),
    ).toBe(true);
    expect(result.ranked_alternatives.length).toBeGreaterThan(0);
    expect(result.iterations.length).toBeGreaterThan(0);
    expect(result.target_profile_preview?.positive_examples.length).toBeGreaterThan(
      0,
    );
    expect(
      result.target_profile_preview?.recruiter_validation_question,
    ).toContain('Find revenue operations leaders');
  });

  it('does not allow a single-family candidate to beat an exhaustive suite on score alone', async () => {
    const suiteCandidate = (service as any).createCandidate(
      'suite-candidate',
      'seed',
      'suite',
      {
        search_query_set: [
          {
            keywords: '"revenue operations" OR revops',
            job_title: null,
            company: null,
            location: ['Bangalore'],
            years_of_experience: null,
          },
          {
            keywords: null,
            job_title: '"Head of Revenue Operations" OR "Director RevOps"',
            company: null,
            location: ['Bangalore'],
            years_of_experience: null,
          },
        ],
      },
    );
    const singleCandidate = (service as any).createCandidate(
      'single-candidate',
      'seed',
      'single',
      {
        search_query_set: [
          {
            keywords: null,
            job_title: '"Head of Revenue Operations" OR "Director RevOps"',
            company: null,
            location: ['Bangalore'],
            years_of_experience: null,
          },
        ],
      },
    );

    suiteCandidate.score = 0.78;
    suiteCandidate.verification_result = {
      ...suiteCandidate.verification_result,
      valid: true,
      score: 0.78,
    };

    singleCandidate.score = 0.84;
    singleCandidate.verification_result = {
      ...singleCandidate.verification_result,
      valid: false,
      score: 0.84,
    };

    const candidates = [singleCandidate, suiteCandidate];
    candidates.sort((left, right) =>
      (service as any).compareCandidatesForSelection(left, right),
    );

    expect(candidates[0].candidate_id).toBe('suite-candidate');
  });

  it('builds target profiles from the raw requirement as well as parsed artifacts', async () => {
    const callLlmSpy = jest.spyOn(service as any, 'callLlm');

    await service.generateIterativeSearchQuerySet(
      'Find revenue operations leaders who may mention forecasting in their profile even without RevOps in the title',
      {
        mode: 'offline',
      },
    );

    const targetProfileCall = callLlmSpy.mock.calls.find((callArgs) => {
      const schemaOption = callArgs[3] as { name: string } | undefined;
      return schemaOption?.name === 'iterativeTargetProfiles';
    });

    expect(targetProfileCall).toBeDefined();
    expect(targetProfileCall?.[1]).toContain('## Raw Requirement');
    expect(targetProfileCall?.[1]).toContain(
      'may mention forecasting in their profile',
    );
  });

  it('normalizes refined mixed query outputs into broader split families', async () => {
    const candidate = (service as any).createCandidate(
      'mixed-candidate',
      'refined',
      'mixed',
      {
        search_query_set: [
          {
            keywords: '"revenue operations" OR revops',
            job_title: '"Head of Revenue Operations" OR "Director RevOps"',
            company: ['Acme'],
            location: ['Bangalore'],
            years_of_experience: null,
          },
        ],
      },
    );

    expect(candidate.query_set.search_query_set.length).toBeGreaterThan(1);
    expect(
      candidate.query_set.search_query_set.every(
        (query: any) => !(query.job_title && query.keywords),
      ),
    ).toBe(true);
    expect(
      candidate.query_set.search_query_set.some(
        (query: any) => query.keywords && query.company === null,
      ),
    ).toBe(true);
  });

  it('fails query sets that exceed the sibling overlap ceiling', () => {
    const verification = (service as any).verifyQuerySet({
      search_query_set: [
        {
          keywords:
            '"channel partner sales" OR "partner sales" OR "channel sales"',
          job_title: null,
          company: null,
          location: ['Gujarat'],
          years_of_experience: null,
        },
        {
          keywords:
            '"channel sales" OR "partner management" OR "channel partner sales"',
          job_title: null,
          company: null,
          location: ['Gujarat'],
          years_of_experience: null,
        },
      ],
    });

    expect(verification.valid).toBe(false);
    expect(
      verification.findings.some(
        (finding: any) => finding.code === 'family_overlap_high',
      ),
    ).toBe(true);
  });

  it('falls back cleanly in live mode when live preview prerequisites are missing', async () => {
    candidateSearchBaseService.getLinkedInAccountId.mockRejectedValue(
      new Error('Failed to get LinkedIn account ID'),
    );

    const result = await service.generateIterativeSearchQuerySet(
      'Find revenue operations leaders',
      {
        mode: 'live',
        apiToken: 'token',
      },
    );

    expect(result.verification_summary.mode).toBe('live');
    expect(result.verification_summary.live_preview_used).toBe(false);
    expect(result.verification_summary.live_preview_fallback_reason).toContain(
      'Failed to get LinkedIn account ID',
    );
  });

  it('uses live preview scores when preview search succeeds', async () => {
    candidateSearchBaseService.getLinkedInAccountId.mockResolvedValue('acc');
    candidateSearchBaseService.resolveSearchParameters.mockImplementation(
      async (params) => params,
    );
    candidateSearchBaseService.executeLinkedInSearch.mockResolvedValue({
      object: 'LinkedinSearchResult',
      items: [
        {
          id: '1',
          name: 'Person One',
          headline: 'Head of Revenue Operations',
          current_position: {
            company: 'Acme',
            company_id: null,
            description: null,
            role: 'Head of Revenue Operations',
            location: 'Bangalore',
            industry: [],
            tenure_at_role: { years: 1, months: 0 },
            tenure_at_company: { years: 1, months: 0 },
            start: { year: 2024, month: 1 },
            skills: null,
          },
        },
        {
          id: '2',
          name: 'Person Two',
          headline: 'Director RevOps',
          current_position: {
            company: 'Beta',
            company_id: null,
            description: null,
            role: 'Director RevOps',
            location: 'Bangalore',
            industry: [],
            tenure_at_role: { years: 1, months: 0 },
            tenure_at_company: { years: 1, months: 0 },
            start: { year: 2024, month: 1 },
            skills: null,
          },
        },
      ],
      cursor: null,
      paging: {
        total_count: 2,
      },
    } as any);
    resultValidationService.validateResultsAgainstQuery.mockResolvedValue({
      isRelevant: true,
      relevanceScore: 0.9,
      falsePositives: [],
      qualityAssessment: 'high',
      shouldContinuePagination: true,
      reasoning: 'Strong top-of-page relevance',
    });

    const result = await service.generateIterativeSearchQuerySet(
      'Find revenue operations leaders',
      {
        mode: 'live',
        apiToken: 'token',
      },
    );

    expect(result.verification_summary.live_preview_used).toBe(true);
    expect(result.verification_summary.final_score).toBeGreaterThan(0.6);
  });
});
