import { Injectable, Logger } from '@nestjs/common';

import { isDefined, isNonEmptyString } from 'twenty-shared/utils';

import {
  WIKIDATA_API_BASE_URL,
  WIKIDATA_PROPERTY,
  WIKIDATA_REQUEST_TIMEOUT_MS,
  WIKIDATA_USER_AGENT,
} from 'src/engine/core-modules/wikidata/constants/wikidata.constants';
import {
  type WikidataCompanyProfile,
  type WikidataCompanySearchResult,
  type WikidataEntity,
} from 'src/engine/core-modules/wikidata/types/wikidata-company.types';
import {
  buildOfficialWebsiteUrlVariants,
  extractBrandFromDomain,
  normalizeCompanyDomain,
} from 'src/engine/core-modules/wikidata/utils/wikidata-domain.util';
import {
  collectReferencedEntityIds,
  getClaimEntityIds,
  mapWikidataEntityToCompanyProfile,
} from 'src/engine/core-modules/wikidata/utils/wikidata-entity-mapper.util';

type MediaWikiSearchResponse = {
  query?: {
    search?: Array<{ title?: string }>;
  };
};

type WbSearchEntitiesResponse = {
  search?: Array<{ id?: string; label?: string; description?: string }>;
};

type WbGetEntitiesResponse = {
  entities?: Record<string, WikidataEntity | { missing?: string }>;
};

@Injectable()
export class WikidataCompanySearchService {
  private readonly logger = new Logger(WikidataCompanySearchService.name);

  async searchByDomain(
    domainOrUrl: string,
  ): Promise<WikidataCompanySearchResult> {
    const normalizedDomain = normalizeCompanyDomain(domainOrUrl);
    const websiteUrlVariants = buildOfficialWebsiteUrlVariants(domainOrUrl);

    if (!normalizedDomain || websiteUrlVariants.length === 0) {
      return {
        query: {
          input: domainOrUrl,
          normalizedDomain: null,
          websiteUrlVariants: [],
        },
        companies: [],
        candidateCount: 0,
      };
    }

    const candidateIds = await this.resolveCandidateEntityIds({
      domain: normalizedDomain,
      websiteUrlVariants,
    });

    const companies = await this.buildProfilesFromEntityIds(
      candidateIds,
      normalizedDomain,
    );

    return {
      query: {
        input: domainOrUrl,
        normalizedDomain,
        websiteUrlVariants,
      },
      companies,
      candidateCount: candidateIds.length,
    };
  }

  async searchByName(
    companyName: string,
    options?: { limit?: number },
  ): Promise<WikidataCompanySearchResult> {
    const trimmedName = companyName.trim();
    const limit = options?.limit ?? 5;

    if (!isNonEmptyString(trimmedName)) {
      return {
        query: {
          input: companyName,
          normalizedDomain: null,
          websiteUrlVariants: [],
        },
        companies: [],
        candidateCount: 0,
      };
    }

    const searchHits = await this.wbSearchEntities(trimmedName, limit);
    const candidateIds = searchHits
      .map((hit) => hit.id)
      .filter((id): id is string => isNonEmptyString(id));

    const companies = await this.buildProfilesFromEntityIds(
      candidateIds,
      trimmedName,
    );

    return {
      query: {
        input: companyName,
        normalizedDomain: null,
        websiteUrlVariants: [],
      },
      companies,
      candidateCount: candidateIds.length,
    };
  }

  private async buildProfilesFromEntityIds(
    candidateIds: string[],
    queryDomainOrName: string,
  ): Promise<WikidataCompanyProfile[]> {
    if (candidateIds.length === 0) {
      return [];
    }

    const entities = await this.getEntities(candidateIds);
    const referencedIds = [
      ...new Set(
        entities.flatMap((entity) => collectReferencedEntityIds(entity)),
      ),
    ].filter((entityId) => !candidateIds.includes(entityId));

    const placeIds = entities.flatMap((entity) =>
      getClaimEntityIds(entity, WIKIDATA_PROPERTY.HEADQUARTERS),
    );
    const placeEntities =
      placeIds.length > 0 ? await this.getEntities([...new Set(placeIds)]) : [];

    for (const placeEntity of placeEntities) {
      referencedIds.push(
        ...getClaimEntityIds(placeEntity, WIKIDATA_PROPERTY.COUNTRY),
      );
    }

    const labelEntities = await this.getEntities([
      ...new Set([...referencedIds, ...placeIds]),
    ]);

    const labelById = new Map<string, string>();

    for (const entity of [...entities, ...placeEntities, ...labelEntities]) {
      const label = entity.labels?.en?.value;

      if (isNonEmptyString(label)) {
        labelById.set(entity.id, label);
      }
    }

    const placeCountryByPlaceId = new Map<string, string>();

    for (const placeEntity of placeEntities) {
      const countryId = getClaimEntityIds(
        placeEntity,
        WIKIDATA_PROPERTY.COUNTRY,
      )[0];

      if (countryId) {
        placeCountryByPlaceId.set(placeEntity.id, countryId);
      }
    }

    return entities
      .map((entity) => {
        const profile = mapWikidataEntityToCompanyProfile({
          entity,
          queryDomain: queryDomainOrName,
          labelById,
        });

        if (!profile.country) {
          const hqId = getClaimEntityIds(
            entity,
            WIKIDATA_PROPERTY.HEADQUARTERS,
          )[0];
          const countryId = hqId
            ? placeCountryByPlaceId.get(hqId)
            : undefined;
          const countryLabel = countryId ? labelById.get(countryId) : undefined;

          if (countryLabel) {
            profile.country = countryLabel;

            if (profile.headquarters) {
              profile.headquarters.country = countryLabel;
              profile.headquarters.label = [
                profile.headquarters.city,
                countryLabel,
              ]
                .filter(Boolean)
                .join(', ');
            }
          }
        }

        return profile;
      })
      .sort((left, right) => right.matchScore - left.matchScore);
  }

  private async resolveCandidateEntityIds({
    domain,
    websiteUrlVariants,
  }: {
    domain: string;
    websiteUrlVariants: string[];
  }): Promise<string[]> {
    const entityIds = new Set<string>();

    for (const websiteUrl of websiteUrlVariants) {
      const hits = await this.searchHasWbStatementOfficialWebsite(websiteUrl);

      for (const entityId of hits) {
        entityIds.add(entityId);
      }
    }

    if (entityIds.size === 0) {
      const brand = extractBrandFromDomain(domain);
      const searchHits = await this.wbSearchEntities(brand, 8);

      for (const hit of searchHits) {
        if (isNonEmptyString(hit.id)) {
          entityIds.add(hit.id);
        }
      }
    }

    return [...entityIds];
  }

  private async searchHasWbStatementOfficialWebsite(
    websiteUrl: string,
  ): Promise<string[]> {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: `haswbstatement:${WIKIDATA_PROPERTY.OFFICIAL_WEBSITE}=${websiteUrl}`,
      srnamespace: '0',
      srlimit: '10',
      format: 'json',
      origin: '*',
    });

    const response = await this.fetchJson<MediaWikiSearchResponse>(
      `${WIKIDATA_API_BASE_URL}?${params.toString()}`,
    );

    return (response.query?.search ?? [])
      .map((hit) => hit.title)
      .filter((title): title is string => isNonEmptyString(title));
  }

  private async wbSearchEntities(
    search: string,
    limit: number,
  ): Promise<Array<{ id?: string; label?: string; description?: string }>> {
    const params = new URLSearchParams({
      action: 'wbsearchentities',
      search,
      language: 'en',
      uselang: 'en',
      type: 'item',
      limit: String(limit),
      format: 'json',
      origin: '*',
    });

    const response = await this.fetchJson<WbSearchEntitiesResponse>(
      `${WIKIDATA_API_BASE_URL}?${params.toString()}`,
    );

    return response.search ?? [];
  }

  private async getEntities(entityIds: string[]): Promise<WikidataEntity[]> {
    const uniqueIds = [...new Set(entityIds.filter(isNonEmptyString))];

    if (uniqueIds.length === 0) {
      return [];
    }

    const entities: WikidataEntity[] = [];

    for (let index = 0; index < uniqueIds.length; index += 50) {
      const chunk = uniqueIds.slice(index, index + 50);
      const params = new URLSearchParams({
        action: 'wbgetentities',
        ids: chunk.join('|'),
        props: 'labels|descriptions|claims|sitelinks',
        languages: 'en',
        format: 'json',
        origin: '*',
      });

      const response = await this.fetchJson<WbGetEntitiesResponse>(
        `${WIKIDATA_API_BASE_URL}?${params.toString()}`,
      );

      for (const entity of Object.values(response.entities ?? {})) {
        if (!isDefined(entity) || 'missing' in entity) {
          continue;
        }

        if (isNonEmptyString(entity.id)) {
          entities.push(entity);
        }
      }
    }

    return entities;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      WIKIDATA_REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': WIKIDATA_USER_AGENT,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Wikidata HTTP ${response.status} ${response.statusText}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      this.logger.warn(
        `Wikidata request failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
