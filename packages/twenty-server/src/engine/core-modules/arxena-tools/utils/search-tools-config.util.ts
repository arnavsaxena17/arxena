import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

export const SEARCH_APOLLO_PEOPLE_TOOL_NAME = 'search_apollo_people';
export const SEARCH_APOLLO_COMPANIES_TOOL_NAME = 'search_apollo_companies';
export const SEARCH_PEOPLE_INDEX_TOOL_NAME = 'search_people_index';
export const SEARCH_FIND_CANDIDATE_INTERNAL_TOOL_NAME =
  'find_candidate_in_arxena_internal';
export const SEARCH_EXA_TOOL_NAME = 'exa_web_search';
export const SEARCH_EXA_APP_TOOL_NAME = 'app_exa_web_search';
export const SEARCH_COMPANIES_INDEX_TOOL_NAME = 'search_companies_index';
export const SEARCH_WIKIDATA_COMPANIES_TOOL_NAME = 'search_wikidata_companies';

export type SearchToolsConfig = {
  isSearchApolloPeopleEnabled: boolean;
  isSearchApolloCompaniesEnabled: boolean;
  isSearchPeopleIndexEnabled: boolean;
  isSearchFindCandidateInternalEnabled: boolean;
  isSearchExaEnabled: boolean;
  isSearchCompaniesIndexEnabled: boolean;
  isSearchWikidataCompaniesEnabled: boolean;
};

/** @deprecated Use SearchToolsConfig */
export type SearchApolloToolsConfig = SearchToolsConfig;

export const resolveSearchToolsConfig = (
  twentyConfigService: TwentyConfigService,
): SearchToolsConfig => ({
  isSearchApolloPeopleEnabled:
    twentyConfigService.get('IS_SEARCH_APOLLO_PEOPLE_ENABLED') !== false,
  isSearchApolloCompaniesEnabled:
    twentyConfigService.get('IS_SEARCH_APOLLO_COMPANIES_ENABLED') !== false,
  isSearchPeopleIndexEnabled:
    twentyConfigService.get('IS_SEARCH_PEOPLE_INDEX_ENABLED') !== false,
  isSearchFindCandidateInternalEnabled:
    twentyConfigService.get('IS_SEARCH_FIND_CANDIDATE_INTERNAL_ENABLED') !==
    false,
  isSearchExaEnabled:
    twentyConfigService.get('IS_SEARCH_EXA_ENABLED') !== false,
  isSearchCompaniesIndexEnabled:
    twentyConfigService.get('IS_SEARCH_COMPANIES_INDEX_ENABLED') !== false,
  isSearchWikidataCompaniesEnabled:
    twentyConfigService.get('IS_SEARCH_WIKIDATA_COMPANIES_ENABLED') !== false,
});

/** @deprecated Use resolveSearchToolsConfig */
export const resolveSearchApolloToolsConfig = resolveSearchToolsConfig;

export const getDisabledSearchToolNames = (
  config: SearchToolsConfig,
): string[] => {
  const disabledToolNames: string[] = [];

  if (!config.isSearchApolloPeopleEnabled) {
    disabledToolNames.push(SEARCH_APOLLO_PEOPLE_TOOL_NAME);
  }

  if (!config.isSearchApolloCompaniesEnabled) {
    disabledToolNames.push(SEARCH_APOLLO_COMPANIES_TOOL_NAME);
  }

  if (!config.isSearchPeopleIndexEnabled) {
    disabledToolNames.push(SEARCH_PEOPLE_INDEX_TOOL_NAME);
  }

  if (!config.isSearchFindCandidateInternalEnabled) {
    disabledToolNames.push(SEARCH_FIND_CANDIDATE_INTERNAL_TOOL_NAME);
  }

  if (!config.isSearchExaEnabled) {
    disabledToolNames.push(SEARCH_EXA_TOOL_NAME, SEARCH_EXA_APP_TOOL_NAME);
  }

  if (!config.isSearchCompaniesIndexEnabled) {
    disabledToolNames.push(SEARCH_COMPANIES_INDEX_TOOL_NAME);
  }

  if (!config.isSearchWikidataCompaniesEnabled) {
    disabledToolNames.push(SEARCH_WIKIDATA_COMPANIES_TOOL_NAME);
  }

  return disabledToolNames;
};

/** @deprecated Use getDisabledSearchToolNames */
export const getDisabledSearchApolloToolNames = getDisabledSearchToolNames;

export const isSearchToolEnabled = (
  toolName: string,
  config: SearchToolsConfig,
): boolean => !getDisabledSearchToolNames(config).includes(toolName);

/** @deprecated Use isSearchToolEnabled */
export const isSearchApolloToolEnabled = isSearchToolEnabled;

export const buildExcludedToolNamesSet = (
  baseExcludedToolNames: Set<string>,
  config: SearchToolsConfig,
): Set<string> => {
  return new Set([
    ...baseExcludedToolNames,
    ...getDisabledSearchToolNames(config),
  ]);
};

const stripMarkedSection = (content: string, markerId: string): string => {
  const pattern = new RegExp(
    `<!-- ${markerId}:start -->[\\s\\S]*?<!-- ${markerId}:end -->\\n?`,
    'g',
  );

  return content.replace(pattern, '');
};

const buildSearchSkillProviderSummary = (config: SearchToolsConfig): string => {
  const providers = ['LinkedIn', 'Harvest'];

  if (
    config.isSearchApolloPeopleEnabled ||
    config.isSearchApolloCompaniesEnabled
  ) {
    providers.push('Apollo');
  }

  if (config.isSearchExaEnabled) {
    providers.push('Exa');
  }

  if (providers.length === 1) {
    return providers[0] ?? '';
  }

  if (providers.length === 2) {
    return `${providers[0]} and ${providers[1]}`;
  }

  const lastProvider = providers[providers.length - 1];

  return `${providers.slice(0, -1).join(', ')}, and ${lastProvider}`;
};

export const filterSearchSkillContent = (
  content: string,
  config: SearchToolsConfig,
): string => {
  let filteredContent = content.replace(
    /<!-- search-skill-provider-summary:start -->[\s\S]*?<!-- search-skill-provider-summary:end -->/,
    buildSearchSkillProviderSummary(config),
  );

  if (!config.isSearchApolloCompaniesEnabled) {
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-apollo-companies-provider-row',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-apollo-companies-learn-tools-line',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-apollo-companies-source-section',
    );
  }

  if (!config.isSearchCompaniesIndexEnabled) {
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-companies-index-provider-row',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-companies-index-learn-tools-line',
    );
  }

  if (!config.isSearchWikidataCompaniesEnabled) {
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-wikidata-companies-provider-row',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-wikidata-companies-learn-tools-line',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-wikidata-companies-source-section',
    );
  }

  if (!config.isSearchExaEnabled) {
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-exa-companies-provider-row',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-exa-companies-learn-tools-line',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-exa-companies-source-section',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-exa-people-provider-row',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-exa-people-learn-tools-line',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-exa-people-source-section',
    );
  }

  if (!config.isSearchApolloPeopleEnabled) {
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-apollo-people-provider-row',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-apollo-people-learn-tools-line',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-apollo-people-source-section',
    );
    filteredContent = filteredContent.replace(
      '2. Search people (LinkedIn / Harvest / Apollo…).',
      '2. Search people (LinkedIn / Harvest…).',
    );
  }

  if (!config.isSearchPeopleIndexEnabled) {
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-people-index-provider-row',
    );
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-people-index-learn-tools-line',
    );
  }

  if (!config.isSearchFindCandidateInternalEnabled) {
    filteredContent = stripMarkedSection(
      filteredContent,
      'search-find-candidate-internal-learn-tools-line',
    );
  }

  return filteredContent;
};
