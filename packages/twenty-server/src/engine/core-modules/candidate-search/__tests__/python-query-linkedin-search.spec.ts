import { Test, TestingModule } from '@nestjs/testing';

import { PythonQueryGenerationService } from '../services/python-query-generation.service';

describe('PythonQueryGenerationService', () => {
  let service: PythonQueryGenerationService;

  const mockFetch = (response: unknown) => {
    return jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    });
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PythonQueryGenerationService],
    }).compile();

    service = module.get(PythonQueryGenerationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateLinkedInQuery', () => {
    it('should call Python API and return LinkedIn-compliant params', async () => {
      const mockResponse = {
        job_title: '"VP" OR "Director" OR "Head"',
        keywords: null,
        company: ['Acme Corp'],
      };

      global.fetch = mockFetch(mockResponse) as typeof fetch;

      const result = await service.generateLinkedInQuery({
        functions: [{ name: 'sales', exclude: false }],
        grades: [{ name: 'leadership', exclude: false }],
        company_names: ['Acme Corp'],
      });

      expect(result.job_title).toBe(mockResponse.job_title);
      expect(result.keywords).toBeNull();
      expect(result.company).toEqual(['Acme Corp']);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/query-generator/linkedin'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should throw when Python API returns error', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      }) as typeof fetch;

      await expect(
        service.generateLinkedInQuery({
          functions: [{ name: 'hr' }],
          grades: [],
        }),
      ).rejects.toThrow(/500/);
    });
  });

  describe('generateSearchParameters', () => {
    it('should map Python response to GeneratedSearchParameters for classic', async () => {
      const mockResponse = {
        job_title: '"VP Sales" OR "Director Sales"',
        keywords: null,
        company: ['Acme'],
      };

      global.fetch = mockFetch(mockResponse) as typeof fetch;

      const result = await service.generateSearchParameters(
        {
          functions: [{ name: 'sales' }],
          grades: [{ name: 'leadership' }],
          company_names: ['Acme'],
        },
        'classic',
        'Find sales leadership at Acme',
      );

      expect(result.classicPeopleSearchStrategies).toBeDefined();
      expect(result.classicPeopleSearchStrategies?.length).toBeGreaterThan(0);

      const strategy = result.classicPeopleSearchStrategies?.[0];
      expect(strategy?.parameters.advanced_keywords?.title).toBe(
        mockResponse.job_title,
      );
      expect(strategy?.parameters.company).toEqual(['acme']);
    });

    it('should produce valid params for LinkedIn search (mocked flow)', async () => {
      const mockResponse = {
        job_title: '"HR" OR "Human Resources" OR "People"',
        keywords: null,
        company: ['TestCorp'],
      };

      global.fetch = mockFetch(mockResponse) as typeof fetch;

      const result = await service.generateSearchParameters(
        {
          functions: [{ name: 'hr' }],
          grades: [{ name: 'mid' }],
          company_names: ['TestCorp'],
        },
        'classic',
      );

      expect(result.classicPeopleSearchStrategies).toBeDefined();
      const strategy = result.classicPeopleSearchStrategies?.[0];
      expect(strategy).toBeDefined();
      expect(strategy?.parameters?.advanced_keywords?.title).toBeTruthy();
      expect(strategy?.parameters?.company).toEqual(['testcorp']);
    });

    it('should use query-set endpoint for function_root and map all queries to strategies', async () => {
      const mockQuerySetResponse = {
        search_query_set: [
          {
            keywords:
              '"human resources" OR "training development" OR recruitment OR "talent acquisition" OR "human resources business" OR recruiter',
            job_title: null,
            company: ['Litify'],
            location: null,
            years_of_experience: null,
          },
          {
            keywords:
              'payroll OR employee OR performance OR benefits OR resource OR rewards',
            job_title: null,
            company: ['Litify'],
            location: null,
            years_of_experience: null,
          },
        ],
      };

      global.fetch = mockFetch(mockQuerySetResponse) as typeof fetch;

      const result = await service.generateSearchParameters(
        {
          function_root: [{ name: 'human resources', exclude: false }],
          company_names: ['Litify'],
        },
        'classic',
        'Find HR talent in Litify',
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/query-generator/linkedin/query-set'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      expect(result.classicPeopleSearchStrategies).toBeDefined();
      expect(result.classicPeopleSearchStrategies?.length).toBe(2);
      expect(result.classicPeopleSearchStrategies?.[0]?.parameters?.keywords).toContain(
        '"human resources"',
      );
      expect(result.classicPeopleSearchStrategies?.[1]?.parameters?.keywords).toContain(
        'payroll',
      );
      expect(result.classicPeopleSearchStrategies?.[0]?.parameters?.company).toEqual([
        'litify',
      ]);
    });
  });
});
