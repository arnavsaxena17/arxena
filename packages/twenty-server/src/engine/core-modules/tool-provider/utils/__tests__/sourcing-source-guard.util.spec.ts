import {
  sourceKeyOfTool,
  sourceRefusalFor,
} from 'src/engine/core-modules/tool-provider/utils/sourcing-source-guard.util';

describe('sourcing source guard', () => {
  it('should map each search tool to its source', () => {
    expect(sourceKeyOfTool('search_bright_data_business')).toBe('bright-data');
    expect(sourceKeyOfTool('google_serp_search')).toBe('serp');
    expect(sourceKeyOfTool('search_harvest_leads')).toBe('harvest');
    expect(sourceKeyOfTool('search_linkedin_continue')).toBe('linkedin');
    expect(sourceKeyOfTool('search_companies_index')).toBe('internal-index');
  });

  it('should leave tools that are not a data source alone', () => {
    expect(sourceKeyOfTool('find_people_by_company')).toBeUndefined();
    expect(sourceKeyOfTool('resolve_company_from_raw_name')).toBeUndefined();
    expect(
      sourceRefusalFor('get_outreach_tab', ['bright-data']),
    ).toBeUndefined();
  });

  it('should restrict nothing without a source choice', () => {
    expect(
      sourceRefusalFor('search_linkedin_people', undefined),
    ).toBeUndefined();
  });

  it('should refuse a source the user did not pick and allow one they did', () => {
    expect(
      sourceRefusalFor('search_linkedin_people', ['bright-data', 'serp']),
    ).toMatch(/LinkedIn \/ Unipile was not picked/);
    expect(
      sourceRefusalFor('search_bright_data_business', ['bright-data']),
    ).toBeUndefined();
  });
});
