import {
  assertOrgChartSearchQueuedResponse,
  assertOrgChartSearchUnipileSuccessResponse,
} from './org-chart-search-response.contract';

describe('org-chart search response contract (POST /org-chart/search output shape)', () => {
  const minimalUnipileSuccess = {
    success: true as const,
    mode: 'entire_company' as const,
    searchType: 'classic' as const,
    companyName: 'BRISKPE',
    jobTitles: [] as string[],
    itemCount: 2,
    items: [
      {
        name: 'Jane Doe',
        jobTitle: 'Engineer',
        company: 'BRISKPE',
        linkedinUrl: 'https://www.linkedin.com/in/jane',
      },
      {
        name: 'John Smith',
        jobTitle: 'PM',
        company: 'BRISKPE',
        linkedinUrl: 'https://www.linkedin.com/in/john',
      },
    ],
    orgChart: {
      type: 'fullcompany',
      orgchart: [{ key: 1, headline: 'Sales' }],
    },
    isCached: false,
    cacheSource: 'none' as const,
  };

  it('accepts a typical Unipile success payload with orgChart', () => {
    expect(() =>
      assertOrgChartSearchUnipileSuccessResponse(minimalUnipileSuccess),
    ).not.toThrow();
  });

  it('accepts business_division_map mode (Unipile success)', () => {
    const businessDivision = {
      ...minimalUnipileSuccess,
      mode: 'business_division_map' as const,
    };
    expect(() =>
      assertOrgChartSearchUnipileSuccessResponse(businessDivision),
    ).not.toThrow();
  });

  it('accepts a cached S3-style payload (same shape, different cacheSource)', () => {
    const s3Like = {
      ...minimalUnipileSuccess,
      isCached: true,
      cacheSource: 's3',
    };
    expect(() =>
      assertOrgChartSearchUnipileSuccessResponse(s3Like),
    ).not.toThrow();
  });

  it('accepts orgChart.orgchart as JSON string (legacy / ES)', () => {
    const withStringOrgchart = {
      ...minimalUnipileSuccess,
      orgChart: {
        type: 'fullcompany',
        orgchart: JSON.stringify([{ key: 1, headline: 'Sales' }]),
      },
    };
    expect(() =>
      assertOrgChartSearchUnipileSuccessResponse(withStringOrgchart),
    ).not.toThrow();
  });

  it('accepts optional orgChartError string alongside partial failure', () => {
    const withError = {
      ...minimalUnipileSuccess,
      orgChartError: 'Python agent timeout',
      orgChart: undefined,
    };
    expect(() =>
      assertOrgChartSearchUnipileSuccessResponse(withError),
    ).not.toThrow();
  });

  it('rejects non-queued response when queued is true', () => {
    const apifyQueued = {
      success: true,
      queued: true,
      candidateSource: 'apify',
      mode: 'entire_company',
      searchType: 'classic',
      companyName: 'Acme',
      companyId: 'acme',
      jobTitles: [],
      linkedinCompanyUrl: 'https://www.linkedin.com/company/acme',
      itemCount: 0,
      items: [],
      orgChart: undefined,
      isCached: false,
      cacheSource: 'none',
    };
    expect(() =>
      assertOrgChartSearchUnipileSuccessResponse(apifyQueued),
    ).toThrow(/queued async/);
    expect(() =>
      assertOrgChartSearchQueuedResponse(apifyQueued),
    ).not.toThrow();
  });

  it('rejects Unipile success when success is not true', () => {
    expect(() =>
      assertOrgChartSearchUnipileSuccessResponse({ ...minimalUnipileSuccess, success: false }),
    ).toThrow();
  });

  it('rejects Unipile success when items is not an array of objects', () => {
    expect(() =>
      assertOrgChartSearchUnipileSuccessResponse({
        ...minimalUnipileSuccess,
        items: [1, 2],
      }),
    ).toThrow(/plain object/);
  });

  it('rejects Unipile success when mode is unknown', () => {
    expect(() =>
      assertOrgChartSearchUnipileSuccessResponse({
        ...minimalUnipileSuccess,
        mode: 'invalid_mode',
      }),
    ).toThrow(/mode/);
  });

  it('assertOrgChartSearchQueuedResponse rejects non-empty items', () => {
    expect(() =>
      assertOrgChartSearchQueuedResponse({
        success: true,
        queued: true,
        candidateSource: 'apify',
        mode: 'entire_company',
        searchType: 'classic',
        companyName: 'Acme',
        jobTitles: [],
        linkedinCompanyUrl: 'https://www.linkedin.com/company/acme',
        itemCount: 1,
        items: [{ name: 'x' }],
        isCached: false,
        cacheSource: 'none',
      }),
    ).toThrow(/empty/);
  });

  it('accepts queued Unipile response', () => {
    expect(() =>
      assertOrgChartSearchQueuedResponse({
        success: true,
        queued: true,
        candidateSource: 'unipile',
        requestId: 'req-1',
        mode: 'entire_company',
        searchType: 'classic',
        companyName: 'Acme',
        jobTitles: [],
        itemCount: 0,
        items: [],
        orgChart: undefined,
        isCached: false,
        cacheSource: 'none',
      }),
    ).not.toThrow();
  });
});
