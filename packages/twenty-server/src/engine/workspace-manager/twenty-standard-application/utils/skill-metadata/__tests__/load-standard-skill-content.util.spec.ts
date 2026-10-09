import { getOutreachSkillContent } from 'twenty-shared/outreach';

import { loadStandardSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/load-standard-skill-content.util';

describe('loadStandardSkillContent', () => {
  it('concatenates search skill parts in order', () => {
    const content = loadStandardSkillContent('search');

    expect(content).toContain('# Search Skill');
    expect(content).toContain('## Companies');
    expect(content).toContain('## People');
    expect(content).toContain('## LinkedIn / Harvest');
    expect(content).toBe(getOutreachSkillContent('search'));
    expect(content.indexOf('## Companies')).toBeLessThan(
      content.indexOf('## People'),
    );
    expect(content.indexOf('## People')).toBeLessThan(
      content.indexOf('## LinkedIn / Harvest'),
    );
  });

  it('loads org-structure-insights from a single markdown file', () => {
    const content = loadStandardSkillContent('org-structure-insights');

    expect(content).toContain('# Org Structure Insights Skill');
    expect(content).toContain('highlight_org_chart');
    expect(content).toContain('Canvas search');
  });

  it('loads local-business-search from a single markdown file', () => {
    const content = loadStandardSkillContent('local-business-search');

    expect(content).toContain('# Local Business Search');
    expect(content).toContain('Fetch & Save Local Businesses');
    expect(content).toContain('plan-local-business-city-coverage');
    expect(content).toContain('fetch-and-upsert-local-businesses');
  });

  it('loads resolve-company-name from a single markdown file', () => {
    const content = loadStandardSkillContent('resolve-company-name');

    expect(content).toContain('# Resolve Company Name');
    expect(content).toContain('resolve_company_from_raw_name');
    expect(content).toContain('std_company_data_scores');
  });

  it('preserves Apollo marker comments for runtime filtering', () => {
    const content = loadStandardSkillContent('search');

    expect(content).toContain(
      '<!-- search-apollo-companies-provider-row:start -->',
    );
    expect(content).toContain(
      '<!-- search-apollo-people-source-section:start -->',
    );
  });
});
