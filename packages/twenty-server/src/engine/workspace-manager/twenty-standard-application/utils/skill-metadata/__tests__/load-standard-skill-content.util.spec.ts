import { getSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

import { loadStandardSkillContent } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/load-standard-skill-content.util';

describe('loadStandardSkillContent', () => {
  it('concatenates search skill parts in order', () => {
    const content = loadStandardSkillContent('search');

    expect(content).toContain('# Search Skill');
    expect(content).toContain('## Companies');
    expect(content).toContain('## People');
    expect(content).toContain('## People by company');
    expect(content).toContain('plan-local-business-city-coverage');
    expect(content).toContain('resolve_company_from_raw_name');
    expect(content).toBe(getSkillContent('search'));
    expect(content.indexOf('## Companies')).toBeLessThan(
      content.indexOf('## People'),
    );
    expect(content.indexOf('## People')).toBeLessThan(
      content.indexOf('## People by company'),
    );
  });

  it('loads org-structure-insights from a single markdown file', () => {
    const content = loadStandardSkillContent('org-structure-insights');

    expect(content).toContain('# Org Structure Insights Skill');
    expect(content).toContain('highlight_org_chart');
    expect(content).toContain('Canvas search');
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
