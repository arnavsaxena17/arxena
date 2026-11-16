import { type LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import { SourcingSpecParserService } from 'src/engine/core-modules/linkedin-query-generation/services/sourcing-spec-parser.service';

describe('SourcingSpecParserService', () => {
  it('should parse with Agent 1 only and return the typed spec', async () => {
    const runAgent1 = jest.fn().mockResolvedValue({
      original_requirement: 'Plant heads in Pune',
      query_type: 'D',
      query_type_description: 'broad',
      position_title: 'Plant Head',
      domain_expertise: [],
      technical_skills: [],
      industry_terms: [],
      certifications: [],
      target_companies: [],
      location: ['Pune'],
      precision_vs_recall: 'high_recall',
    });
    const generateSearchQuerySet = jest.fn();
    const service = new SourcingSpecParserService({
      runAgent1,
      generateSearchQuerySet,
    } as unknown as LinkedinQueryGenerationService);

    const spec = await service.parse('Plant heads in Pune', {
      targetCount: 40,
    });

    expect(runAgent1).toHaveBeenCalledWith('Plant heads in Pune', undefined);
    expect(generateSearchQuerySet).not.toHaveBeenCalled();
    expect(spec.hard.map((constraint) => constraint.userWords)).toEqual([
      'Plant Head',
      'Pune',
    ]);
    expect(spec.target).toEqual({ count: 40 });
  });
});
