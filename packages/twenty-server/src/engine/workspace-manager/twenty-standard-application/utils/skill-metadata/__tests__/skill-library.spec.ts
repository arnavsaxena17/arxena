import {
  ALL_SEARCH_TOOLS_ENABLED,
  filterSearchSkillContent,
  type SearchToolsConfig,
} from 'src/engine/core-modules/arxena-tools/utils/search-tools-config';
import { buildRoutingLines } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/build-routing-lines.util';
import { selectSkillSections } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/select-skill-sections.util';
import {
  getSkillContent,
  getSkillFrontMatter,
  listPlaybookNames,
  listRoutedSkillNames,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

const PROVIDER_FILTERED_SKILL_NAMES = [
  'search',
  'org-structure-insights',
] as const;

const ALL_DISABLED: SearchToolsConfig = Object.fromEntries(
  Object.keys(ALL_SEARCH_TOOLS_ENABLED).map((key) => [key, false]),
) as SearchToolsConfig;

describe('skill library', () => {
  it('should expose every skill that has front matter by name', () => {
    expect(listRoutedSkillNames().sort()).toEqual([
      'ai-filter-enrich',
      'dashboard-building',
      'data-manipulation',
      'metadata-building',
      'org-structure-insights',
      'outreach',
      'search',
      'setup',
      'spreadsheet-import',
      'view-building',
      'view-filters-and-sorts',
      'workflow-building',
    ]);
  });

  it('should include resolve_company_from_raw_name in the search skill', () => {
    expect(getSkillContent('search')).toContain(
      'resolve_company_from_raw_name',
    );
  });

  it('should strip every provider marker when all providers are disabled', () => {
    for (const skillName of PROVIDER_FILTERED_SKILL_NAMES) {
      const filtered = filterSearchSkillContent(
        getSkillContent(skillName),
        ALL_DISABLED,
      );

      expect(filtered).not.toMatch(/<!-- [a-z0-9-]+:(start|end) -->/);
    }
  });

  it.each(Object.keys(ALL_SEARCH_TOOLS_ENABLED))(
    'should change the skill text when %s is disabled',
    (flag) => {
      const content =
        PROVIDER_FILTERED_SKILL_NAMES.map(getSkillContent).join('\n');
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

describe('selectSkillSections', () => {
  const searchContent = getSkillContent('search');

  it('should list the sections of the search skill', () => {
    expect(selectSkillSections(searchContent).availableSections).toEqual([
      'companies',
      'people',
      'people-by-company',
    ]);
  });

  it('should return the whole skill when no sections are requested', () => {
    expect(selectSkillSections(searchContent).content).toBe(searchContent);
  });

  it('should return only the head and the requested section', () => {
    const { content } = selectSkillSections(searchContent, ['people']);

    expect(content).toContain('# Search Skill');
    expect(content).toContain('## People');
    expect(content).not.toContain('## Companies');
    expect(content).not.toContain('## People by company');
    expect(content).toContain('Not loaded: companies, people-by-company');
    expect(content.length).toBeLessThan(searchContent.length);
  });

  it('should report sections that do not exist', () => {
    const { unknownSections } = selectSkillSections(searchContent, [
      'people',
      'nope',
    ]);

    expect(unknownSections).toEqual(['nope']);
  });

  it('should leave a skill without sections unchanged', () => {
    const outreachContent = getSkillContent('outreach');

    expect(selectSkillSections(outreachContent, ['people']).content).toBe(
      outreachContent,
    );
  });
});

describe('search skill section sizes', () => {
  const full = getSkillContent('search');
  const tokens = (sections: string[]) =>
    Math.ceil(selectSkillSections(full, sections).content.length / 4);

  // Loading a slice must stay far cheaper than the whole skill, since the
  // loaded text is re-sent on every model step that follows
  it.each([
    [['people'], 14_000],
    [['companies'], 14_000],
    [['people-by-company'], 12_000],
  ])('should keep %j under %i tokens', (sections, budget) => {
    expect(tokens(sections)).toBeLessThanOrEqual(budget);
  });
});

describe('skill front matter and playbooks', () => {
  const PLAYBOOK_TOKEN_BUDGET = 1_500;

  it.each(listRoutedSkillNames())(
    'should give %s a description and at least one route',
    (skillName) => {
      const frontMatter = getSkillFrontMatter(skillName);

      expect(frontMatter?.description.trim()).not.toBe('');
      expect(frontMatter?.routes.length).toBeGreaterThan(0);
    },
  );

  it('should not leak front matter or unresolved includes into any skill', () => {
    for (const skillName of listRoutedSkillNames()) {
      const content = getSkillContent(skillName);

      expect(content.startsWith('---')).toBe(false);
      expect(content).not.toContain('{{include');
    }
  });

  it('should have no playbook files', () => {
    expect(listPlaybookNames()).toEqual([]);
    expect(listRoutedSkillNames()).not.toContain('find-role-at-companies');
  });

  it('should keep every playbook short', () => {
    for (const playbookName of listPlaybookNames()) {
      expect(
        Math.ceil(getSkillContent(playbookName).length / 4),
      ).toBeLessThanOrEqual(PLAYBOOK_TOKEN_BUDGET);
    }
  });

  it('should write one routing line per route, ordered by priority', () => {
    const lines = buildRoutingLines().split('\n');
    const routeCount = listRoutedSkillNames().reduce(
      (total, skillName) =>
        total + (getSkillFrontMatter(skillName)?.routes.length ?? 0),
      0,
    );

    expect(lines).toHaveLength(routeCount);
    expect(lines[0]).toContain('load_skills(["setup"])');
    expect(lines.join('\n')).toContain('load_skills(["search"])');
    expect(lines.join('\n')).not.toContain('find-role-at-companies');
  });

  it('should add a surface suffix at the {suffix} marker or at the end', () => {
    const lines = buildRoutingLines({
      routingLineSuffixes: {
        'org-structure-insights': ' SUFFIX-A.',
        outreach: ' SUFFIX-B.',
      },
    });

    expect(lines).toContain('. SUFFIX-A. Keep LinkedIn sourcing on `search`.');
    expect(lines).toContain('. SUFFIX-B.');
  });

  it('should include extra skills in a load call', () => {
    expect(
      buildRoutingLines({
        extraSkillNames: { outreach: ['workflow-building'] },
      }),
    ).toContain('load_skills(["outreach", "workflow-building"])');
  });

  it('should resolve a shared fragment into every skill that includes it', () => {
    const sentence =
      'Boolean title strings ("(VP OR Head) AND Sales NOT assistant")';

    expect(getSkillContent('search')).toContain(sentence);
    expect(getSkillContent('search').split(sentence).length - 1).toBe(2);
  });
});
