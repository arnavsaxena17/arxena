import { Logger } from '@nestjs/common';

import { LinkedInClassicPeopleSearchRequest } from '../types/linkedin-search-request.type';

/**
 * Persisted GraphQL query id for flagship people search (SRP). LinkedIn rotates these;
 * override via env / options if requests fail with query errors.
 */
export const DEFAULT_VOYAGER_SEARCH_DASH_CLUSTERS_QUERY_ID =
  'voyagerSearchDashClusters.05111e1b90ee7fea15bebe9f9410ced9';

export type VoyagerPeopleSearchGraphqlBuildOptions = {
  start?: number;
  queryId?: string;
};

/**
 * Builds the same Voyager GET shape as the browser:
 * /voyager/api/graphql?variables=(...)&queryId=voyagerSearchDashClusters.<hash>
 *
 * Keyword values use encodeURIComponent inside the variables string (matches public
 * examples); the variables substring is not fully URI-encoded again to avoid double-encoding.
 */
export class VoyagerPeopleSearchGraphqlBuilder {
  private static readonly logger = new Logger(VoyagerPeopleSearchGraphqlBuilder.name);

  static buildGraphqlUrl(
    params: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
    options: VoyagerPeopleSearchGraphqlBuildOptions = {},
  ): string {
    const start = options.start ?? 0;
    const queryId = options.queryId ?? DEFAULT_VOYAGER_SEARCH_DASH_CLUSTERS_QUERY_ID;
    const variablesString = this.buildVariablesString(params, start);
    const url = `https://www.linkedin.com/voyager/api/graphql?variables=${variablesString}&queryId=${queryId}`;
    this.logger.log(`Built Voyager people search GraphQL URL (start=${start})`);
    return url;
  }

  /**
   * Rest.li-style variables fragment for voyagerSearchDashClusters (people SRP).
   */
  static buildVariablesString(
    params: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
    start: number,
  ): string {
    const keywords = this.buildKeywordsFragment(params);
    const queryParameters = this.buildQueryParametersList(params);
    return (
      `(start:${start},origin:SWITCH_SEARCH_VERTICAL,` +
      `query:(keywords:${keywords},flagshipSearchIntent:SEARCH_SRP,` +
      `queryParameters:${queryParameters},includeFiltersInResponse:false))`
    );
  }

  private static buildKeywordsFragment(
    params: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
  ): string {
    const raw = this.resolvePrimaryKeywords(params);
    return encodeURIComponent(raw);
  }

  /**
   * Primary keyword line for the voyager `keywords:` field (may be empty when filters carry intent).
   */
  static resolvePrimaryKeywords(
    params: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
  ): string {
    if (params.keywords && params.keywords.trim().length > 0) {
      return params.keywords.trim();
    }
    const ak = params.advanced_keywords;
    if (ak?.first_name || ak?.last_name) {
      return [ak?.first_name, ak?.last_name].filter(Boolean).join(' ').trim();
    }
    if (ak?.company && ak.company.trim().length > 0) {
      return ak.company.trim();
    }
    return '';
  }

  private static buildQueryParametersList(
    params: Omit<LinkedInClassicPeopleSearchRequest, 'api' | 'category'>,
  ): string {
    const tuples: string[] = ['(key:resultType,value:List(PEOPLE))'];

    if (params.network_distance && params.network_distance.length > 0) {
      const networkValues = params.network_distance.map((dist) => {
        if (dist === 1) return 'S';
        if (dist === 2 || dist === 3) return 'O';
        return 'O';
      });
      const encoded = networkValues.map((v) => encodeURIComponent(v)).join(',');
      tuples.push(`(key:network,value:List(${encoded}))`);
    }

    if (params.location && params.location.length > 0) {
      const encoded = params.location.map((id) => encodeURIComponent(id)).join(',');
      tuples.push(`(key:geoUrn,value:List(${encoded}))`);
    }

    if (params.company && params.company.length > 0) {
      const encoded = params.company.map((id) => encodeURIComponent(id)).join(',');
      tuples.push(`(key:currentCompany,value:List(${encoded}))`);
    }

    if (params.past_company && params.past_company.length > 0) {
      const encoded = params.past_company.map((id) => encodeURIComponent(id)).join(',');
      tuples.push(`(key:pastCompany,value:List(${encoded}))`);
    }

    if (params.industry && params.industry.length > 0) {
      const encoded = params.industry.map((id) => encodeURIComponent(id)).join(',');
      tuples.push(`(key:industry,value:List(${encoded}))`);
    }

    if (params.school && params.school.length > 0) {
      const encoded = params.school.map((id) => encodeURIComponent(id)).join(',');
      tuples.push(`(key:schoolFilter,value:List(${encoded}))`);
    }

    const ak = params.advanced_keywords;
    if (ak?.first_name) {
      tuples.push(`(key:firstName,value:List(${encodeURIComponent(ak.first_name)}))`);
    }
    if (ak?.last_name) {
      tuples.push(`(key:lastName,value:List(${encodeURIComponent(ak.last_name)}))`);
    }
    if (ak?.title) {
      tuples.push(`(key:title,value:List(${encodeURIComponent(ak.title)}))`);
    }
    if (ak?.company) {
      tuples.push(`(key:company,value:List(${encodeURIComponent(ak.company)}))`);
    }
    if (ak?.school) {
      tuples.push(`(key:schoolFreetext,value:List(${encodeURIComponent(ak.school)}))`);
    }

    return `List(${tuples.join(',')})`;
  }
}
