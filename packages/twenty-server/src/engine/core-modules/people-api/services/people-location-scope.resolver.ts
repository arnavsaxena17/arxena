import { Injectable, Logger } from '@nestjs/common';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { LinkedinParameterResolver } from 'src/engine/core-modules/candidate-search/utils/linkedin-parameter-resolver.util';

import type { PeopleDataSourceAlias } from '../constants/people-data-source-aliases';

export type PeopleLocationScopeResolvedVia =
  | 'linkedin'
  | 'unresolved'
  | 'omitted';

export type PeopleLocationScope = {
  raw?: string;
  linkedinLocationId?: string;
  linkedinLocationName?: string;
  resolvedVia: PeopleLocationScopeResolvedVia;
};

export type ResolvePeopleLocationScopeInput = {
  location?: string;
  country?: string;
  accountId?: string;
  dataSource?: PeopleDataSourceAlias;
};

const LINKEDIN_LOCATION_DATA_SOURCES = new Set<PeopleDataSourceAlias>([
  'apollo',
  'harvest',
  'unipile',
  'pool',
]);

@Injectable()
export class PeopleLocationScopeResolver {
  private readonly logger = new Logger(PeopleLocationScopeResolver.name);

  constructor(
    private readonly linkedinParameterResolver: LinkedinParameterResolver,
    private readonly linkedinUnipileEstimateAccountService: LinkedinUnipileEstimateAccountService,
  ) {}

  async resolve(
    input: ResolvePeopleLocationScopeInput,
  ): Promise<PeopleLocationScope> {
    const raw = input.location?.trim() || input.country?.trim() || undefined;
    if (!raw || raw.toLowerCase() === 'global') {
      return { resolvedVia: 'omitted' };
    }

    const shouldResolveLinkedinFacet = this.shouldResolveLinkedinFacet(input);
    if (!shouldResolveLinkedinFacet) {
      return {
        raw,
        linkedinLocationName: raw,
        resolvedVia: 'unresolved',
      };
    }

    const accountId = await this.resolveLinkedinAccountId(input);
    if (!accountId) {
      this.logger.log(
        `People API location "${raw}" left unresolved (no LinkedIn account for facet lookup)`,
      );
      return {
        raw,
        linkedinLocationName: raw,
        resolvedVia: 'unresolved',
      };
    }

    try {
      const resolved = await this.linkedinParameterResolver.resolveLocationName(
        raw,
        accountId,
      );
      if (!resolved) {
        this.logger.warn(
          `People API LinkedIn location facet not found for "${raw}"`,
        );
        return {
          raw,
          linkedinLocationName: raw,
          resolvedVia: 'unresolved',
        };
      }

      this.logger.log(
        `People API location "${raw}" resolved to "${resolved.title}" (${resolved.id})`,
      );

      return {
        raw,
        linkedinLocationId: resolved.id,
        linkedinLocationName: resolved.title,
        resolvedVia: 'linkedin',
      };
    } catch (error) {
      this.logger.warn(
        `People API LinkedIn location resolve failed for "${raw}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        raw,
        linkedinLocationName: raw,
        resolvedVia: 'unresolved',
      };
    }
  }

  private shouldResolveLinkedinFacet(
    input: ResolvePeopleLocationScopeInput,
  ): boolean {
    const dataSource = input.dataSource ?? 'index';
    return LINKEDIN_LOCATION_DATA_SOURCES.has(dataSource);
  }

  private async resolveLinkedinAccountId(
    input: ResolvePeopleLocationScopeInput,
  ): Promise<string | undefined> {
    const explicitAccountId = input.accountId?.trim() || undefined;
    if (explicitAccountId) {
      return explicitAccountId;
    }

    if (input.dataSource === 'unipile') {
      return undefined;
    }

    try {
      return await this.linkedinUnipileEstimateAccountService.resolveSharedSalesNavigatorPoolAccountId(
        'People API location',
      );
    } catch (error) {
      this.logger.warn(
        `People API location pool account unavailable: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return undefined;
    }
  }
};
