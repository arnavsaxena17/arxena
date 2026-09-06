import {
  filterSearchSkillContent,
  getDisabledSearchToolNames,
  isSearchToolEnabled,
  resolveSearchToolsConfig,
  SEARCH_APOLLO_COMPANIES_TOOL_NAME,
  SEARCH_APOLLO_PEOPLE_TOOL_NAME,
  SEARCH_COMPANIES_INDEX_TOOL_NAME,
  SEARCH_EXA_APP_TOOL_NAME,
  SEARCH_EXA_TOOL_NAME,
  SEARCH_FIND_CANDIDATE_INTERNAL_TOOL_NAME,
  SEARCH_PEOPLE_INDEX_TOOL_NAME,
  SEARCH_SERP_TOOL_NAME,
  SEARCH_WIKIDATA_COMPANIES_TOOL_NAME,
} from 'src/engine/core-modules/arxena-tools/utils/search-tools-config.util';
import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

type SearchToolsConfigKey =
  | 'IS_SEARCH_APOLLO_PEOPLE_ENABLED'
  | 'IS_SEARCH_APOLLO_COMPANIES_ENABLED'
  | 'IS_SEARCH_PEOPLE_INDEX_ENABLED'
  | 'IS_SEARCH_FIND_CANDIDATE_INTERNAL_ENABLED'
  | 'IS_SEARCH_EXA_ENABLED'
  | 'IS_SEARCH_SERP_ENABLED'
  | 'IS_SEARCH_COMPANIES_INDEX_ENABLED'
  | 'IS_SEARCH_WIKIDATA_COMPANIES_ENABLED';

const buildConfigService = (
  values: Partial<Record<SearchToolsConfigKey, boolean>>,
): TwentyConfigService =>
  ({
    get: (key: string) => values[key as SearchToolsConfigKey],
  }) as TwentyConfigService;

describe('search-tools-config.util', () => {
  it('defaults search tools to enabled', () => {
    const config = resolveSearchToolsConfig(buildConfigService({}));

    expect(getDisabledSearchToolNames(config)).toEqual([]);
    expect(isSearchToolEnabled(SEARCH_APOLLO_PEOPLE_TOOL_NAME, config)).toBe(
      true,
    );
    expect(isSearchToolEnabled(SEARCH_COMPANIES_INDEX_TOOL_NAME, config)).toBe(
      true,
    );
  });

  it('disables search tools when env flags are false', () => {
    const config = resolveSearchToolsConfig(
      buildConfigService({
        IS_SEARCH_APOLLO_PEOPLE_ENABLED: false,
        IS_SEARCH_APOLLO_COMPANIES_ENABLED: false,
        IS_SEARCH_PEOPLE_INDEX_ENABLED: false,
        IS_SEARCH_FIND_CANDIDATE_INTERNAL_ENABLED: false,
        IS_SEARCH_EXA_ENABLED: false,
        IS_SEARCH_SERP_ENABLED: false,
        IS_SEARCH_COMPANIES_INDEX_ENABLED: false,
        IS_SEARCH_WIKIDATA_COMPANIES_ENABLED: false,
      }),
    );

    expect(getDisabledSearchToolNames(config)).toEqual([
      SEARCH_APOLLO_PEOPLE_TOOL_NAME,
      SEARCH_APOLLO_COMPANIES_TOOL_NAME,
      SEARCH_PEOPLE_INDEX_TOOL_NAME,
      SEARCH_FIND_CANDIDATE_INTERNAL_TOOL_NAME,
      SEARCH_EXA_TOOL_NAME,
      SEARCH_EXA_APP_TOOL_NAME,
      SEARCH_SERP_TOOL_NAME,
      SEARCH_COMPANIES_INDEX_TOOL_NAME,
      SEARCH_WIKIDATA_COMPANIES_TOOL_NAME,
    ]);
  });

  it('strips marked search skill sections when tools are disabled', () => {
    const content = [
      '<!-- search-skill-provider-summary:start -->LinkedIn, Harvest, Apollo, and Exa<!-- search-skill-provider-summary:end --> intro',
      '<!-- search-apollo-companies-provider-row:start -->| Apollo companies |<!-- search-apollo-companies-provider-row:end -->',
      '<!-- search-companies-index-provider-row:start -->| companies index |<!-- search-companies-index-provider-row:end -->',
      '<!-- search-wikidata-companies-source-section:start -->## Wikidata<!-- search-wikidata-companies-source-section:end -->',
      '<!-- search-exa-people-source-section:start -->## Exa people<!-- search-exa-people-source-section:end -->',
      '<!-- search-people-index-learn-tools-line:start -->  "search_people_index",<!-- search-people-index-learn-tools-line:end -->',
      '<!-- search-find-candidate-internal-learn-tools-line:start -->  "find_candidate_in_arxena_internal"<!-- search-find-candidate-internal-learn-tools-line:end -->',
    ].join('\n');

    const filtered = filterSearchSkillContent(
      content,
      resolveSearchToolsConfig(
        buildConfigService({
          IS_SEARCH_APOLLO_COMPANIES_ENABLED: false,
          IS_SEARCH_COMPANIES_INDEX_ENABLED: false,
          IS_SEARCH_WIKIDATA_COMPANIES_ENABLED: false,
          IS_SEARCH_EXA_ENABLED: false,
          IS_SEARCH_PEOPLE_INDEX_ENABLED: false,
          IS_SEARCH_FIND_CANDIDATE_INTERNAL_ENABLED: false,
        }),
      ),
    );

    expect(filtered).not.toContain('Apollo companies');
    expect(filtered).not.toContain('companies index');
    expect(filtered).not.toContain('Wikidata');
    expect(filtered).not.toContain('Exa people');
    expect(filtered).not.toContain('search_people_index');
    expect(filtered).not.toContain('find_candidate_in_arxena_internal');
    expect(filtered).toContain('LinkedIn, Harvest, and Apollo intro');
  });

  it('strips org-structure Exa and SERP sections when those flags are false', () => {
    const content = [
      'learn_tools([',
      '  "get_org_chart_node_people",',
      '<!-- org-structure-exa-learn-tools-line:start -->',
      '  "app_exa_web_search",',
      '<!-- org-structure-exa-learn-tools-line:end -->',
      '<!-- org-structure-serp-learn-tools-line:start -->',
      '  "google_serp_search",',
      '<!-- org-structure-serp-learn-tools-line:end -->',
      '  "highlight_org_chart"',
      '])',
      '<!-- org-structure-web-search-section:start -->',
      '## Playbook C — Web corroboration',
      '<!-- org-structure-exa-playbook:start -->',
      '- `app_exa_web_search`',
      '<!-- org-structure-exa-playbook:end -->',
      '<!-- org-structure-serp-playbook:start -->',
      '- `google_serp_search`',
      '<!-- org-structure-serp-playbook:end -->',
      '<!-- org-structure-web-search-section:end -->',
    ].join('\n');

    const bothDisabled = filterSearchSkillContent(
      content,
      resolveSearchToolsConfig(
        buildConfigService({
          IS_SEARCH_EXA_ENABLED: false,
          IS_SEARCH_SERP_ENABLED: false,
        }),
      ),
    );

    expect(bothDisabled).not.toContain('app_exa_web_search');
    expect(bothDisabled).not.toContain('google_serp_search');
    expect(bothDisabled).not.toContain('Web corroboration');
    expect(bothDisabled).toContain('get_org_chart_node_people');

    const serpOnly = filterSearchSkillContent(
      content,
      resolveSearchToolsConfig(
        buildConfigService({
          IS_SEARCH_EXA_ENABLED: true,
          IS_SEARCH_SERP_ENABLED: false,
        }),
      ),
    );

    expect(serpOnly).toContain('app_exa_web_search');
    expect(serpOnly).not.toContain('google_serp_search');
    expect(serpOnly).toContain('Web corroboration');
  });
});
