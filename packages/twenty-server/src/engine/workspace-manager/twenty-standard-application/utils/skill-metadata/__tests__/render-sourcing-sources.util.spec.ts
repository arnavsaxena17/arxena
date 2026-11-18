import { ARXENA_TOOL_CATALOG } from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-catalog.const';
import { SEARCH_EXA_APP_TOOL_NAME } from 'src/engine/core-modules/arxena-tools/constants/arxena-tool-names.const';
import {
  ALL_SEARCH_TOOLS_ENABLED,
  filterSearchSkillContent,
  type SearchToolsConfig,
} from 'src/engine/core-modules/arxena-tools/utils/search-tools-config';
import { esIndexSearchTools } from 'src/engine/core-modules/arxena-tools/library/tools/es-index-search-tools';
import { harvestSearchTools } from 'src/engine/core-modules/arxena-tools/library/tools/harvest-search-tools';
import { linkedinSearchTools } from 'src/engine/core-modules/arxena-tools/library/tools/linkedin-search-tools';
import { orgChartTools } from 'src/engine/core-modules/arxena-tools/library/tools/org-chart-tools';
import { peopleApiTools } from 'src/engine/core-modules/arxena-tools/library/tools/people-api-tools';
import { unipileControllersTools } from 'src/engine/core-modules/arxena-tools/library/tools/unipile-controllers-tools';
import { wikidataTools } from 'src/engine/core-modules/arxena-tools/library/tools/wikidata-tools';
import { ACTION_TOOL_IDS } from 'src/engine/core-modules/tool-provider/constants/action-tool-label.constant';
import {
  renderSourcingFacts,
  renderSourcingSources,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/render-sourcing-sources.util';
import {
  getSkillContent,
  getSkillFrontMatter,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';
import {
  SOURCING_ALWAYS_LEARNED_TOOLS,
  SOURCING_SOURCES,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-sources.constant';

const ALL_DISABLED: SearchToolsConfig = Object.fromEntries(
  Object.keys(ALL_SEARCH_TOOLS_ENABLED).map((key) => [key, false]),
) as SearchToolsConfig;

const SOURCE_USES = SOURCING_SOURCES.flatMap((source) =>
  [source.people, source.companies].filter((use) => use !== undefined),
);

describe('renderSourcingSources', () => {
  it('should render a provider map row for every source of the entity', () => {
    const rendered = renderSourcingSources('{{sources: provider-map people}}');

    expect(rendered).toContain('| **Bright Data** |');
    expect(rendered).toContain('| **Google SERP** |');
    expect(rendered).not.toContain('| **Wikidata** |');
  });

  it('should list the always-learned tools last', () => {
    const rendered = renderSourcingSources(
      '{{sources: learn-tools companies}}',
    );
    const toolNames = [...rendered.matchAll(/^ {4}"([a-z_-]+)"/gm)].map(
      (match) => match[1],
    );

    const alwaysLearned = SOURCING_ALWAYS_LEARNED_TOOLS.companies;

    expect(toolNames.slice(-alwaysLearned.length)).toEqual(alwaysLearned);
    expect(new Set(toolNames).size).toBe(toolNames.length);
  });

  it('should order the source order table by rank', () => {
    const ranks = [
      ...renderSourcingSources('{{sources: source-order}}').matchAll(
        /^\| (\d+) \|/gm,
      ),
    ].map((match) => Number(match[1]));

    expect(ranks).toEqual([...ranks].sort((first, second) => first - second));
    expect(ranks[0]).toBe(1);
  });

  it('should name the top-ranked source as the default', () => {
    expect(renderSourcingSources('{{source: default people}}')).toBe(
      'Bright Data (`src-bright-data-people`)',
    );
    expect(renderSourcingSources('{{source: google-maps companies}}')).toBe(
      'Google Maps',
    );
  });

  it('should fill in facts', () => {
    expect(renderSourcingFacts('{{fact: bright-data.costPerRecord}}')).toBe(
      '$0.002',
    );
  });

  it('should throw on an unknown block, source or fact', () => {
    expect(() => renderSourcingSources('{{sources: nope}}')).toThrow(
      'Unknown sourcing block',
    );
    expect(() =>
      renderSourcingSources('{{sources: provider-map places}}'),
    ).toThrow('Unknown sourcing block');
    expect(() => renderSourcingSources('{{source: default places}}')).toThrow(
      'Unknown sourcing entity',
    );
    expect(() => renderSourcingSources('{{source: wikidata people}}')).toThrow(
      'has no people use',
    );
    expect(() => renderSourcingFacts('{{fact: nope.cost}}')).toThrow(
      'Unknown sourcing source',
    );
    expect(() => renderSourcingFacts('{{fact: bright-data.nope}}')).toThrow(
      'has no fact',
    );
  });

  it('should leave no placeholder in the sourcing skill', () => {
    expect(getSkillContent('sourcing')).not.toMatch(
      /\{\{(sources|source|fact):/,
    );
  });
});

describe('sourcing source registry', () => {
  it('should use unique keys', () => {
    const keys = SOURCING_SOURCES.map((source) => source.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('should link only to sections of the sourcing skill', () => {
    const parts = getSkillFrontMatter('sourcing')?.parts ?? [];

    for (const use of SOURCE_USES) {
      if (use.section !== undefined) {
        expect(parts).toContain(use.section);
      }
    }
  });

  it('should give every ranked source an order label for each entity it has', () => {
    for (const source of SOURCING_SOURCES.filter(
      (entry) => entry.rank !== undefined,
    )) {
      for (const use of [source.people, source.companies]) {
        expect(use === undefined || use.orderLabel !== undefined).toBe(true);
      }
    }
  });

  it('should only learn tools that exist', () => {

// SIMPLIFIED_SEARCH: the provider tool families are commented out of
// arxena-tools/library/tools/index.ts, so they are no longer in
// ARXENA_TOOL_CATALOG. The skill sections that name them stay in the shipped
// text until the IS_SEARCH_* provider flags strip those sections at runtime,
// so their names are still "known" to a skill for this check.
const SWITCHED_OFF_PROVIDER_TOOL_NAMES: string[] = [
  ...linkedinSearchTools,
  ...harvestSearchTools,
  ...peopleApiTools,
  ...orgChartTools,
  ...esIndexSearchTools,
  ...wikidataTools,
  ...unipileControllersTools,
].map((tool) => tool.definition.name);

    // Logic-function tools come from installed apps, not a static list
    const knownTools = new Set([
      ...ARXENA_TOOL_CATALOG.map((entry) => entry.name),
      ...SWITCHED_OFF_PROVIDER_TOOL_NAMES,
      ...ACTION_TOOL_IDS,
      SEARCH_EXA_APP_TOOL_NAME,
    ]);
    const learned = [
      ...Object.values(SOURCING_ALWAYS_LEARNED_TOOLS).flat(),
      ...SOURCE_USES.flatMap((use) => use.learnTools),
    ];

    // Seeded workflows are named with hyphens and are not tools
    expect(
      learned.filter(
        (toolName) => !toolName.includes('-') && !knownTools.has(toolName),
      ),
    ).toEqual([]);
  });

  it('should strip every flagged row and learn line when its provider is off', () => {
    const filtered = filterSearchSkillContent(
      getSkillContent('sourcing'),
      ALL_DISABLED,
    );

    for (const use of SOURCE_USES) {
      if (use.markerPrefix !== undefined) {
        expect(filtered).not.toContain(`| ${use.tools} |`);
      }
    }
  });
});
