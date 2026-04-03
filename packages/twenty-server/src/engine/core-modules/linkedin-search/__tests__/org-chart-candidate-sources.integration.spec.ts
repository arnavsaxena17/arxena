import { Test } from '@nestjs/testing';
import { ApifyService } from 'src/engine/core-modules/apify/services/apify.service';
import { ApifyLinkedInCompanyProfileTransformerService } from 'src/engine/core-modules/candidate-sourcing/services/data-sources/apify-linkedin-company-profile-transformer.service';
import {
    LinkedInSearchTransformerService,
    type TransformedCandidateForTable,
} from 'src/engine/core-modules/candidate-sourcing/services/data-sources/linkedin-search-transformer.service';
import { DataProcessingUtils } from 'src/engine/core-modules/candidate-sourcing/utils/data-processing.utils';
import { LinkedInHtmlParserService } from 'src/engine/core-modules/linkedin-search/services/linkedin-html-parser.service';
import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { LinkedInSessionTrackerService } from 'src/engine/core-modules/linkedin-search/services/linkedin-session-tracker.service';
import type { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { WorkspaceQueryService } from 'src/engine/core-modules/workspace-modifications/workspace-modifications.service';

const COMPANY_LI = 'https://www.linkedin.com/company/acme-corp';

/** Fields org-chart LinkedIn build + filters rely on (see org-chart-linkedin-build filters + candidate list). */
const ORG_CHART_CANDIDATE_SHAPE_KEYS = [
  'name',
  'jobTitle',
  'company',
  'headline',
  'linkedinUrl',
  'location',
  'locationName',
  'locationCountry',
  'locationRegion',
  'locationLocality',
  'campaign',
  'source',
] as const;

function assertOrgChartTableRow(
  row: TransformedCandidateForTable,
  context: string,
): void {
  for (const key of ORG_CHART_CANDIDATE_SHAPE_KEYS) {
    expect(row).toHaveProperty(key);
  }
  expect(typeof row.name).toBe('string');
  expect(typeof row.jobTitle).toBe('string');
  expect(typeof row.company).toBe('string');
  expect(typeof row.headline).toBe('string');
  expect(typeof row.linkedinUrl).toBe('string');
  expect(typeof row.location).toBe('string');
  expect(typeof row.campaign).toBe('string');
  expect(typeof row.source).toBe('string');
  if (row.locationCountry !== undefined && row.locationCountry !== null) {
    expect(typeof row.locationCountry).toBe('string');
  }
  if (row.locationRegion !== undefined && row.locationRegion !== null) {
    expect(typeof row.locationRegion).toBe('string');
  }
  if (row.locationLocality !== undefined && row.locationLocality !== null) {
    expect(typeof row.locationLocality).toBe('string');
  }
  if (row.locationName !== undefined && row.locationName !== null) {
    expect(typeof row.locationName).toBe('string');
  }
  console.log(`[org-chart-candidate-sources] ${context} ok: name=${row.name}`);
}

function minimalUnipilePeopleResult(
  id: string,
): LinkedInPeopleSearchResult {
  return {
    object: 'SearchResult',
    type: 'PEOPLE',
    id,
    public_identifier: 'jane-doe',
    public_profile_url: 'https://www.linkedin.com/in/jane-doe',
    profile_url: 'https://www.linkedin.com/in/jane-doe',
    profile_picture_url: null,
    profile_picture_url_large: null,
    member_urn: null,
    name: 'Jane Doe',
    first_name: 'Jane',
    last_name: 'Doe',
    network_distance: 'DISTANCE_2',
    location: 'Berlin, Germany',
    industry: null,
    keywords_match: '',
    headline: 'Engineer at Acme',
    connections_count: 0,
    followers_count: 0,
    pending_invitation: false,
    can_send_inmail: false,
    hiddenCandidate: false,
    interestLikelihood: '',
    privacySettings: {
      allowConnectionsBrowse: true,
      showPremiumSubscriberIcon: false,
    },
    skills: [],
    premium: false,
    verified: false,
    open_profile: false,
    shared_connections_count: 0,
    recent_posts_count: 0,
    recently_hired: false,
    mentioned_in_the_news: false,
    current_positions: [
      {
        company: 'Acme',
        company_id: null,
        description: null,
        role: 'Engineer',
        location: 'Berlin',
        industry: [],
        tenure_at_role: { years: 1, months: 0 },
        tenure_at_company: { years: 1, months: 0 },
        start: { year: 2023, month: 1 },
        skills: null,
      },
    ],
    education: [],
    work_experience: [],
    certifications: [],
    projects: [],
  };
}

const APIFY_ACTOR_FIXTURE_ROWS: Record<string, unknown>[] = [
  {
    firstName: 'John',
    lastName: 'Smith',
    headline: 'Product Manager at Acme',
    linkedinUrl: 'https://www.linkedin.com/in/johnsmith',
    photo: 'https://example.com/john.jpg',
    location: {
      linkedinText: 'San Francisco, CA',
      parsed: {
        text: 'San Francisco, CA',
        country: 'United States',
        countryCode: 'US',
        state: 'California',
        city: 'San Francisco',
      },
    },
    currentPosition: [{ companyName: 'Acme' }],
    experience: [
      {
        companyName: 'Acme',
        position: 'Product Manager',
      },
    ],
  },
];

describe('Org chart candidate sources (integration-style: real transformers, mocked Apify / no HTTP)', () => {
  let linkedInSearchService: LinkedInSearchService;
  let apifyService: jest.Mocked<Pick<ApifyService, 'isConfigured' | 'runActorAndListDatasetItems'>>;
  let linkedInSearchTransformer: LinkedInSearchTransformerService;
  let apifyLinkedInTransformer: ApifyLinkedInCompanyProfileTransformerService;

  beforeEach(async () => {
    const apifyMock: jest.Mocked<
      Pick<ApifyService, 'isConfigured' | 'runActorAndListDatasetItems'>
    > = {
      isConfigured: jest.fn().mockReturnValue(true),
      runActorAndListDatasetItems: jest
        .fn()
        .mockResolvedValue(APIFY_ACTOR_FIXTURE_ROWS),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LinkedInSearchService,
        ApifyLinkedInCompanyProfileTransformerService,
        LinkedInSearchTransformerService,
        DataProcessingUtils,
        { provide: LinkedInSessionTrackerService, useValue: {} },
        { provide: WorkspaceQueryService, useValue: {} },
        { provide: LinkedInHtmlParserService, useValue: {} },
        { provide: ApifyService, useValue: apifyMock },
      ],
    }).compile();

    linkedInSearchService = moduleRef.get(LinkedInSearchService);
    apifyService = moduleRef.get(ApifyService);
    linkedInSearchTransformer = moduleRef.get(LinkedInSearchTransformerService);
    apifyLinkedInTransformer = moduleRef.get(
      ApifyLinkedInCompanyProfileTransformerService,
    );
  });

  it('Unipile-shaped LinkedInPeopleSearchResult → table format matches org-chart candidate contract', () => {
    const table = linkedInSearchTransformer.transformSearchResultsToTableFormat(
      [minimalUnipilePeopleResult('u1')],
      'linkedin_search_job',
      'Unipile Search',
    );
    const withMeta = linkedInSearchTransformer.addMetadataToCandidates(table, {
      searchType: 'classic',
      searchCategory: 'people',
      timestamp: new Date().toISOString(),
      processingTime: 0,
    });

    expect(withMeta).toHaveLength(1);
    assertOrgChartTableRow(withMeta[0], 'unipile-shaped');
  });

  it('Apify actor rows → transformApifyRowsToTableFormat matches the same org-chart candidate contract', () => {
    const rows = apifyLinkedInTransformer.transformApifyRowsToTableFormat(
      APIFY_ACTOR_FIXTURE_ROWS,
      {
        defaultCompanyName: 'Acme',
        companyLinkedinUrl: COMPANY_LI,
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].jobCompanyLinkedinUrl).toBe(COMPANY_LI.trim());
    assertOrgChartTableRow(rows[0], 'apify-transformer');
  });

  it('LinkedInSearchService.fetchCompanyEmployeesViaApifyActor uses the transformer and returns the same contract', async () => {
    const rows = await linkedInSearchService.fetchCompanyEmployeesViaApifyActor({
      linkedinCompanyUrl: COMPANY_LI,
      maxItems: 50,
      defaultCompanyName: 'Acme Corp',
      companyLinkedinUrl: COMPANY_LI,
    });

    expect(apifyService.isConfigured).toHaveBeenCalled();
    expect(apifyService.runActorAndListDatasetItems).toHaveBeenCalled();
    expect(rows).toHaveLength(1);
    assertOrgChartTableRow(rows[0], 'fetchCompanyEmployeesViaApifyActor');
    expect(rows[0].jobCompanyLinkedinUrl).toBe(COMPANY_LI.trim());
  });

  it('Unipile and Apify pipelines expose overlapping string fields for downstream org-chart code', () => {
    const unipile = linkedInSearchTransformer.addMetadataToCandidates(
      linkedInSearchTransformer.transformSearchResultsToTableFormat(
        [minimalUnipilePeopleResult('parity')],
        'job',
        'x',
      ),
      {
        searchType: 'classic',
        searchCategory: 'people',
        timestamp: new Date().toISOString(),
        processingTime: 0,
      },
    );
    const apify = apifyLinkedInTransformer.transformApifyRowsToTableFormat(
      APIFY_ACTOR_FIXTURE_ROWS,
      { defaultCompanyName: 'Acme', companyLinkedinUrl: COMPANY_LI },
    );

    const keysBothMustHave: (keyof TransformedCandidateForTable)[] = [
      'name',
      'jobTitle',
      'company',
      'headline',
      'linkedinUrl',
      'campaign',
      'source',
    ];

    for (const key of keysBothMustHave) {
      expect(typeof unipile[0][key]).toBe(typeof apify[0][key]);
    }
  });
});
