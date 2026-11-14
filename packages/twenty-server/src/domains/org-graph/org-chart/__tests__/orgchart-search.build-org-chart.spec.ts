jest.mock('openai', () => ({
  __esModule: true,
  default: class MockOpenAI {
    constructor(_opts?: { apiKey?: string }) {}
  },
}));

import { Test } from '@nestjs/testing';
import { CandidateAvatarStorageService } from 'src/engine/core-modules/candidate-avatar/services/candidate-avatar-storage.service';
import { OrgChartChartBuildService } from 'src/domains/org-graph/org-chart/build/services/orgchart-chart-build.service';
import { LinkedInRecruiterPeopleTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-recruiter-people-transformer.service';
import { LinkedInSearchTransformerService } from 'src/domains/ingestion/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { OrgChartProfileDataSourceMapperService } from 'src/domains/org-graph/org-chart/services/org-chart-profile-data-source-mapper.service';
import { PythonOrgChartService } from 'src/domains/org-graph/org-chart/services/python-org-chart.service';

describe('OrgChartChartBuildService.buildOrgChartFromLinkedInCompanyCandidates', () => {
  let service: OrgChartChartBuildService;
  let pythonOrgChartService: { createOrgChartFromStandardizedPeople: jest.Mock };

  beforeEach(async () => {
    pythonOrgChartService = {
      createOrgChartFromStandardizedPeople: jest
        .fn()
        .mockResolvedValue({ type: 'fullcompany', orgchart: [] }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartChartBuildService,
        { provide: PythonOrgChartService, useValue: pythonOrgChartService },
        OrgChartProfileDataSourceMapperService,
        {
          provide: CandidateAvatarStorageService,
          useValue: { ingestBatch: jest.fn((people) => Promise.resolve(people)) },
        },
        { provide: LinkedInSearchTransformerService, useValue: {} },
        { provide: LinkedInRecruiterPeopleTransformerService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(OrgChartChartBuildService);
  });

  it('passes canonical company LinkedIn URL to Python when companyLinkedinUrl is set (e.g. briskpe)', async () => {
    const canonical = 'https://www.linkedin.com/company/briskpe';

    const result = await service.buildOrgChartFromLinkedInCompanyCandidates(
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
        website: 'https://briskpe.com',
      },
    );

    expect(result.job_company_website).toBe('https://briskpe.com');
    expect(result.job_company_linkedin_url).toBe(canonical);

    expect(pythonOrgChartService.createOrgChartFromStandardizedPeople).toHaveBeenCalled();
    const callArg =
      pythonOrgChartService.createOrgChartFromStandardizedPeople.mock
        .calls[0][0];
    expect(callArg.people).toHaveLength(1);
    expect(callArg.people[0].job_company_linkedin_url).toBe(canonical);
  });

  it('maps snake_case linkedin_url on candidates to Python linkedin_url', async () => {
    await service.buildOrgChartFromLinkedInCompanyCandidates(
      [
        {
          name: 'Snake User',
          jobTitle: 'Engineer',
          company: 'Acme',
          linkedin_url: 'https://www.linkedin.com/in/snake-case',
        } as never,
      ],
      {
        companyName: 'Acme',
        companyId: 'acme',
        mode: 'entire_company',
        companyLinkedinUrl: 'https://www.linkedin.com/company/acme',
      },
    );

    const callArg =
      pythonOrgChartService.createOrgChartFromStandardizedPeople.mock
        .calls[0][0];
    expect(callArg.people[0].linkedin_url).toBe(
      'https://www.linkedin.com/in/snake-case',
    );
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

  it('entire_company without asOfMonth sets job_title from company-matching experience over headline', async () => {
    await service.buildOrgChartFromLinkedInCompanyCandidates(
      [
        {
          name: 'Pat',
          jobTitle: 'CEO elsewhere',
          headline: 'CEO elsewhere',
          job_title: 'CEO elsewhere',
          company: 'Acme',
          linkedinUrl: 'https://www.linkedin.com/in/pat',
          org_contactout_experience: [
            {
              company_name: 'Acme',
              title: 'Director',
              start_date_year: 2023,
              start_date_month: 4,
              is_current: true,
            },
          ],
        } as never,
      ],
      {
        companyName: 'Acme',
        companyId: 'acme',
        mode: 'entire_company',
      },
    );

    const callArg =
      pythonOrgChartService.createOrgChartFromStandardizedPeople.mock.calls[0][0];
    expect(callArg.people[0].job_title).toBe('Director');
  });

  it('asOfMonth takes precedence over entire_company experience title rewrite', async () => {
    await service.buildOrgChartFromLinkedInCompanyCandidates(
      [
        {
          name: 'Pat',
          jobTitle: 'CEO elsewhere',
          headline: 'CEO elsewhere',
          org_contactout_experience: [
            {
              company_name: 'Acme',
              title: 'Director',
              start_date_year: 2023,
              start_date_month: 4,
              is_current: true,
            },
          ],
        } as never,
      ],
      {
        companyName: 'Acme',
        companyId: 'acme',
        mode: 'entire_company',
        asOfMonth: '2020-01',
      },
    );

    const callArg =
      pythonOrgChartService.createOrgChartFromStandardizedPeople.mock.calls[0][0];
    expect(callArg.people).toHaveLength(0);
  });
});
