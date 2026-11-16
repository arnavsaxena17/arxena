import { ARXENA_TOOL_CATALOG } from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import {
  SOURCE_GUARD_EXEMPT_TOOLS,
  sourceKeyOfTool,
  sourceKeysOfCall,
  sourceRefusalFor,
} from 'src/engine/core-modules/tool-provider/utils/sourcing-source-guard.util';

// Names that read as a call to an outside data source
const SPENDING_TOOL_NAME =
  /^(search_|google_serp_|fetch_contacts|fetch_email|fetch_phone|list_linkedin_relations)/;

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

  it('should guard the LinkedIn seat tools', () => {
    for (const toolName of [
      'search_linkedin_from_url',
      'search_linkedin_jobs',
      'search_linkedin_posts',
      'list_linkedin_relations',
    ]) {
      expect(sourceRefusalFor(toolName, ['bright-data'])).toMatch(
        /LinkedIn \/ Unipile was not picked/,
      );
    }
  });

  it('should guard the People API by its dataSource', () => {
    expect(
      sourceRefusalFor('search_people_api', ['harvest'], {
        dataSource: 'harvest',
      }),
    ).toBeUndefined();
    expect(
      sourceRefusalFor('search_people_api', ['harvest'], {
        dataSource: 'apollo',
      }),
    ).toMatch(/Apollo was not picked/);
    expect(
      sourceRefusalFor('search_people_by_job_title', ['internal-index'], {}),
    ).toMatch(/without dataSource/);
    expect(
      sourceRefusalFor('search_people_api', ['linkedin', 'internal-index'], {
        dataSource: 'auto',
      }),
    ).toBeUndefined();
  });

  it('should guard or deliberately exempt every source-spending tool', () => {
    const unguarded = ARXENA_TOOL_CATALOG.map((entry) => entry.name).filter(
      (toolName) =>
        SPENDING_TOOL_NAME.test(toolName) &&
        !(toolName in SOURCE_GUARD_EXEMPT_TOOLS) &&
        sourceKeysOfCall(toolName, { dataSource: 'apollo' }).length === 0,
    );

    expect(unguarded).toEqual([]);
  });
});
