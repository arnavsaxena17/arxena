import {
  LinkedinQueryGenerationService,
  toPythonQueryInput,
} from 'src/domains/discovery/query/linkedin-query-generation/services/linkedin-query-generation.service';
import { type ParsedRequirement } from 'src/domains/discovery/query/linkedin-query-generation/types/linkedin-query-generation.types';

const requirement = (
  overrides: Partial<ParsedRequirement> = {},
): ParsedRequirement => ({
  original_requirement: 'CFO at listed pharma companies in Mumbai',
  query_type: 'A',
  query_type_description: '',
  position_title: 'CFO',
  domain_expertise: [],
  technical_skills: [],
  industry_terms: ['pharma'],
  certifications: [],
  target_companies: ['Cipla', ' '],
  location: ['Mumbai'],
  precision_vs_recall: 'balanced',
  ...overrides,
});

describe('toPythonQueryInput', () => {
  it('should forward the title, the employers and the place', () => {
    expect(toPythonQueryInput(requirement())).toEqual({
      company_names: ['Cipla'],
      raw_job_titles: ['CFO'],
      locations: ['Mumbai'],
    });
  });

  it('should leave out what the requirement does not state', () => {
    expect(
      toPythonQueryInput(
        requirement({
          position_title: undefined,
          target_companies: [],
          location: [],
        }),
      ),
    ).toEqual({ company_names: [] });
  });
});

describe('LinkedinQueryGenerationService.generateSearchQuerySet', () => {
  it('should parse once, build with Python, then fold the requirement in', async () => {
    const generateQuerySet = jest.fn(async () => ({
      search_query_set: [
        {
          keywords: null,
          job_title: 'CFO',
          company: ['Cipla'],
          location: ['Mumbai'],
          years_of_experience: null,
        },
      ],
    }));
    const service = new LinkedinQueryGenerationService(
      { generateQuerySet } as never,
      null,
    );

    jest.spyOn(service, 'runAgent1').mockResolvedValue(requirement());

    const result = await service.generateSearchQuerySet('CFO at pharma');

    expect(generateQuerySet).toHaveBeenCalledWith({
      company_names: ['Cipla'],
      raw_job_titles: ['CFO'],
      locations: ['Mumbai'],
    });
    expect(result.final_query_set.search_query_set).toHaveLength(1);
    expect(result.final_query_set.search_query_set[0]).toMatchObject({
      job_title: 'CFO',
      keywords: '(pharma)',
      industry_terms: ['pharma'],
    });
    expect(result.dropped_requirement_terms).toEqual([]);
  });
});
