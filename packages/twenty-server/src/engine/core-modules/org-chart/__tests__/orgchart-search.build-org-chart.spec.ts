jest.mock('openai', () => ({
  __esModule: true,
  default: class MockOpenAI {
    constructor(_opts?: { apiKey?: string }) {}
  },
}));

import { Test } from '@nestjs/testing';
import { BusinessDivisionOrgChartParserService } from 'src/engine/core-modules/candidate-search/services/business-division-org-chart-parser.service';
import { CandidateSearchBaseService } from 'src/engine/core-modules/candidate-search/services/candidate-search-base.service';
import { OrgChartSearchService } from 'src/engine/core-modules/candidate-search/services/orgchart-search.service';
import { PythonQueryGenerationService } from 'src/engine/core-modules/candidate-search/services/python-query-generation.service';
import { RequirementAnalyzerService } from 'src/engine/core-modules/candidate-search/services/requirement-analyzer.service';
import { SearchExecutionService } from 'src/engine/core-modules/candidate-search/services/search-execution.service';
import { LinkedinParameterResolver } from 'src/engine/core-modules/candidate-search/utils';
import { LinkedinQueryGenerationService } from 'src/engine/core-modules/linkedin-query-generation/services/linkedin-query-generation.service';
import { OrgChartCacheService } from 'src/engine/core-modules/org-chart/services/orgchart-cache.service';
import { OrgchartCancelRegistryService } from 'src/engine/core-modules/org-chart/services/orgchart-cancel-registry.service';
import { PythonOrgChartService } from 'src/engine/core-modules/org-chart/services/python-org-chart.service';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

describe('OrgChartSearchService.buildOrgChartFromLinkedInCompanyCandidates', () => {
  let service: OrgChartSearchService;
  let pythonOrgChartService: { createOrgChartFromStandardizedPeople: jest.Mock };

  beforeEach(async () => {
    pythonOrgChartService = {
      createOrgChartFromStandardizedPeople: jest
        .fn()
        .mockResolvedValue({ type: 'fullcompany', orgchart: [] }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartSearchService,
        { provide: SearchExecutionService, useValue: {} },
        { provide: LinkedinParameterResolver, useValue: {} },
        { provide: CandidateSearchBaseService, useValue: {} },
        { provide: LinkedinQueryGenerationService, useValue: {} },
        { provide: PythonQueryGenerationService, useValue: {} },
        { provide: RequirementAnalyzerService, useValue: {} },
        { provide: PythonOrgChartService, useValue: pythonOrgChartService },
        { provide: OrgchartCancelRegistryService, useValue: {} },
        { provide: WorkspaceQueryService, useValue: {} },
        { provide: OrgChartCacheService, useValue: {} },
        { provide: BusinessDivisionOrgChartParserService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(OrgChartSearchService);
  });

  it('passes canonical company LinkedIn URL to Python when companyLinkedinUrl is set (e.g. briskpe)', async () => {
    const canonical = 'https://www.linkedin.com/company/briskpe';

    await service.buildOrgChartFromLinkedInCompanyCandidates(
      [
        {
          name: 'Test User',
          jobTitle: 'Engineer',
          company: 'BRISKPE',
          linkedinUrl: 'https://www.linkedin.com/in/example',
        } as never,
      ],
      {
        companyName: 'BRISKPE',
        companyId: 'briskpe',
        mode: 'entire_company',
        companyLinkedinUrl: `${canonical}/`,
      },
    );

    expect(pythonOrgChartService.createOrgChartFromStandardizedPeople).toHaveBeenCalled();
    const callArg =
      pythonOrgChartService.createOrgChartFromStandardizedPeople.mock
        .calls[0][0];
    expect(callArg.people).toHaveLength(1);
    expect(callArg.people[0].job_company_linkedin_url).toBe(canonical);
  });

  it('derives /company/{companyId} when companyLinkedinUrl is omitted', async () => {
    await service.buildOrgChartFromLinkedInCompanyCandidates(
      [
        {
          name: 'A',
          jobTitle: 'B',
          company: 'Acme',
          linkedinUrl: '',
        } as never,
      ],
      {
        companyName: 'Acme',
        companyId: 'acme-corp',
        mode: 'entire_company',
      },
    );

    const callArg =
      pythonOrgChartService.createOrgChartFromStandardizedPeople.mock
        .calls[0][0];
    expect(callArg.people[0].job_company_linkedin_url).toBe(
      'https://www.linkedin.com/company/acme-corp',
    );
  });
});
