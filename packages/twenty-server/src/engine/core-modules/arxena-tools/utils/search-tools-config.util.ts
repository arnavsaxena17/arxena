import { type TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';
import {
  type SearchToolsConfig,
  getDisabledSearchToolNames,
  isSearchToolEnabled,
} from 'twenty-shared/outreach';

export {
  SEARCH_APOLLO_COMPANIES_TOOL_NAME,
  SEARCH_APOLLO_PEOPLE_TOOL_NAME,
  SEARCH_BRIGHT_DATA_BUSINESS_TOOL_NAME,
  SEARCH_COMPANIES_INDEX_TOOL_NAME,
  SEARCH_EXA_APP_TOOL_NAME,
  SEARCH_EXA_TOOL_NAME,
  SEARCH_FIND_CANDIDATE_INTERNAL_TOOL_NAME,
  SEARCH_PEOPLE_INDEX_TOOL_NAME,
  SEARCH_SERP_TOOL_NAME,
  SEARCH_WIKIDATA_COMPANIES_TOOL_NAME,
  buildExcludedToolNamesSet,
  filterSearchSkillContent,
  getDisabledSearchToolNames,
  isSearchToolEnabled,
} from 'twenty-shared/outreach';
export type { SearchToolsConfig } from 'twenty-shared/outreach';

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
  isSearchSerpEnabled:
    twentyConfigService.get('IS_SEARCH_SERP_ENABLED') !== false,
  isSearchCompaniesIndexEnabled:
    twentyConfigService.get('IS_SEARCH_COMPANIES_INDEX_ENABLED') !== false,
  isSearchWikidataCompaniesEnabled:
    twentyConfigService.get('IS_SEARCH_WIKIDATA_COMPANIES_ENABLED') !== false,
  isSearchBrightDataEnabled:
    twentyConfigService.get('IS_SEARCH_BRIGHT_DATA_ENABLED') !== false,
});

/** @deprecated Use resolveSearchToolsConfig */
export const resolveSearchApolloToolsConfig = resolveSearchToolsConfig;

/** @deprecated Use getDisabledSearchToolNames */
export const getDisabledSearchApolloToolNames = getDisabledSearchToolNames;

/** @deprecated Use isSearchToolEnabled */
export const isSearchApolloToolEnabled = isSearchToolEnabled;
