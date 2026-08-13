import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { LinkedinUnipileEstimateAccountService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-estimate-account.service';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';

export type PeopleSalesNavAccountSource = 'unipile' | 'harvest' | 'pool';

export type ResolvePeopleSalesNavAccountInput = {
  candidateSource?: PeopleSalesNavAccountSource;
  accountId?: string;
  linkedInAccountId?: string;
};

export type ResolvedPeopleSalesNavAccount = {
  candidateSource: PeopleSalesNavAccountSource;
  /** Unipile account id when source is unipile or pool; undefined for harvest. */
  linkedinUnipileAccountId?: string;
};

@Injectable()
export class PeopleSalesNavAccountResolver {
  private readonly logger = new Logger(PeopleSalesNavAccountResolver.name);

  constructor(
    private readonly harvestLinkedinService: HarvestLinkedinService,
    private readonly linkedinUnipileEstimateAccountService: LinkedinUnipileEstimateAccountService,
  ) {}

  isUnipileConfigured(): boolean {
    return (
      !!process.env.UNIPILE_API_URL?.trim() &&
      !!process.env.UNIPILE_ACCESS_TOKEN?.trim()
    );
  }

  async resolve(
    input: ResolvePeopleSalesNavAccountInput,
  ): Promise<ResolvedPeopleSalesNavAccount> {
    const explicitAccountId =
      input.accountId?.trim() || input.linkedInAccountId?.trim() || undefined;
    const requestedSource = input.candidateSource;

    if (requestedSource === 'harvest') {
      if (!this.harvestLinkedinService.isConfigured()) {
        throw new HttpException(
          'Harvest data source is not configured',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return { candidateSource: 'harvest' };
    }

    if (requestedSource === 'pool') {
      if (!this.isUnipileConfigured()) {
        throw new HttpException(
          'Unipile is not configured for Sales Navigator pool search',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const poolAccountId =
        await this.linkedinUnipileEstimateAccountService.resolveSharedSalesNavigatorPoolAccountId(
          'People API Sales Nav pool',
        );

      this.logger.log(
        `People API Sales Nav using pool account ${poolAccountId}`,
      );

      return {
        candidateSource: 'pool',
        linkedinUnipileAccountId: poolAccountId,
      };
    }

    // Default / unipile: require explicit account id or fail closed
    if (requestedSource === 'unipile' || explicitAccountId) {
      if (!this.isUnipileConfigured()) {
        throw new HttpException(
          'Unipile is not configured for Sales Navigator search',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      if (!explicitAccountId) {
        throw new HttpException(
          'accountId (or linkedInAccountId) is required when candidateSource is unipile',
          HttpStatus.BAD_REQUEST,
        );
      }

      return {
        candidateSource: 'unipile',
        linkedinUnipileAccountId: explicitAccountId,
      };
    }

    throw new HttpException(
      'Provide candidateSource as harvest | pool | unipile (with accountId)',
      HttpStatus.BAD_REQUEST,
    );
  }
}
