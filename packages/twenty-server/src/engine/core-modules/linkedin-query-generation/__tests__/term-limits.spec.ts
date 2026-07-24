import { LinkedinQueryGenerationService } from '../services/linkedin-query-generation.service';

describe('LinkedinQueryGenerationService - term limits', () => {
  let service: LinkedinQueryGenerationService;

  beforeEach(() => {
    service = new LinkedinQueryGenerationService(null);
  });

  describe('validateQuerySet', () => {
    it('rejects query with keywords > 6 terms', () => {
      const result = service.validateQuerySet({
        search_query_set: [
          {
            keywords: 'a OR b OR c OR d OR e OR f OR g',
            job_title: null,
            company: null,
            location: null,
            years_of_experience: null,
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('keywords'))).toBe(true);
    });

    it('rejects query with job_title > 6 terms', () => {
      const result = service.validateQuerySet({
        search_query_set: [
          {
            keywords: null,
            job_title: '"VP" OR "Director" OR "Head" OR "Manager" OR "Lead" OR "Chief" OR "President"',
            company: null,
            location: null,
            years_of_experience: null,
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('job_title'))).toBe(true);
    });

    it('rejects query with combined terms > 10', () => {
      const result = service.validateQuerySet({
        search_query_set: [
          {
            keywords: 'a OR b OR c OR d OR e OR f',
            job_title: '"x" OR "y" OR "z" OR "w" OR "v"',
            company: null,
            location: null,
            years_of_experience: null,
          },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('combined'))).toBe(true);
    });

    it('accepts query within limits', () => {
      const result = service.validateQuerySet({
        search_query_set: [
          {
            keywords: '"VP" OR "Director" OR "Head"',
            job_title: null,
            company: ['Acme'],
            location: null,
            years_of_experience: null,
          },
        ],
      });
      expect(result.valid).toBe(true);
    });
  });
});
