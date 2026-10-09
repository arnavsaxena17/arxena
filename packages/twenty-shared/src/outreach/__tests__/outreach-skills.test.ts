import {
  ALL_SEARCH_TOOLS_ENABLED,
  type SearchToolsConfig,
} from '../search-tools-config';
import { filterSearchSkillContent } from '../search-tools-config';
import {
  getOutreachSkillContent,
  listOutreachSkillNames,
} from '../outreach-skills';

const PROVIDER_FILTERED_SKILL_NAMES = ['search', 'org-structure-insights'] as const;

const ALL_DISABLED: SearchToolsConfig = Object.fromEntries(
  Object.keys(ALL_SEARCH_TOOLS_ENABLED).map((key) => [key, false]),
) as SearchToolsConfig;

describe('outreach skills', () => {
  it('should expose every shared playbook by name', () => {
    expect(listOutreachSkillNames().sort()).toEqual([
      'ai-filter-enrich',
      'local-business-search',
      'org-structure-insights',
      'outreach',
      'resolve-company-name',
      'search',
      'setup',
    ]);
  });

  it('should include resolve_company_from_raw_name in the search skill', () => {
    expect(getOutreachSkillContent('search')).toContain(
      'resolve_company_from_raw_name',
    );
  });

  it('should strip every provider marker when all providers are disabled', () => {
    for (const skillName of PROVIDER_FILTERED_SKILL_NAMES) {
      const filtered = filterSearchSkillContent(
        getOutreachSkillContent(skillName),
        ALL_DISABLED,
      );

      expect(filtered).not.toMatch(/<!-- [a-z0-9-]+:(start|end) -->/);
    }
  });

  it.each(Object.keys(ALL_SEARCH_TOOLS_ENABLED))(
    'should change the skill text when %s is disabled',
    (flag) => {
      const content = PROVIDER_FILTERED_SKILL_NAMES.map(getOutreachSkillContent)
        .join('\n');
      const filtered = filterSearchSkillContent(content, {
        ...ALL_SEARCH_TOOLS_ENABLED,
        [flag]: false,
      });

      expect(filtered).not.toEqual(
        filterSearchSkillContent(content, ALL_SEARCH_TOOLS_ENABLED),
      );
    },
  );
});
