import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { UnipileSearchAccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-search-account.resolver';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';

import {
  JOB_DATA_SOURCE_CATEGORIES,
  type JobDataSourceAlias,
} from './constants/job-data-source-aliases';
import type { JobSearchDto } from './dto/job-search.dto';
import type {
  JobDataSourcesStatusResponse,
  JobSearchResponse,
} from './jobs-api.types';
import { JobSearchDataSourceResolver } from './services/job-search-data-source.resolver';
import { JobSearchHitTransformer } from './services/job-search-hit.transformer';

@Injectable()
export class JobApiService {
  constructor(
    private readonly harvestLinkedinService: HarvestLinkedinService,
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
    private readonly jobSearchDataSourceResolver: JobSearchDataSourceResolver,
    private readonly jobSearchHitTransformer: JobSearchHitTransformer,
  ) {}

  getDataSourcesStatus(): JobDataSourcesStatusResponse {
    const unipileConfigured =
      this.unipileSearchAccountResolver.isUnipileConfigured();
    const configuredByAlias: Record<JobDataSourceAlias, boolean> = {
      auto: unipileConfigured || this.harvestLinkedinService.isConfigured(),
      harvest: this.harvestLinkedinService.isConfigured(),
      unipile: unipileConfigured,
      pool: unipileConfigured,
      recruiter: unipileConfigured,
    };

    return {
      status: 'ok',
      sources: JOB_DATA_SOURCE_CATEGORIES.map((category) => ({
        alias: category.alias,
        label: category.label,
        description: category.description,
        configured: configuredByAlias[category.alias],
      })),
    };
  }

  async searchJobs(
    body: JobSearchDto,
    apiToken?: string,
  ): Promise<JobSearchResponse> {
    const resolved = await this.jobSearchDataSourceResolver.resolve({
      dataSource: body.dataSource,
      accountId: body.accountId,
      apiToken,
    });
    const limit = Math.max(1, Math.min(100, body.limit ?? 20));
    const keywords = body.keywords?.trim() || '';

    if (resolved.dataSource === 'harvest') {
      if (!this.harvestLinkedinService.isConfigured()) {
        throw new HttpException(
          'Harvest data source is not configured',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      const result = await this.harvestLinkedinService.searchJobs({
        search: keywords,
        location: body.location,
        company: body.company,
        datePosted: body.datePosted,
        limit,
      });

      return {
        status: 'ok',
        dataSource: 'harvest',
        total: result.total,
        items: result.items.map((item) =>
          this.jobSearchHitTransformer.fromHarvestItem(item),
        ),
      };
    }

    if (!resolved.accountId) {
      throw new HttpException(
        'A LinkedIn Unipile account is required for this job search data source',
        HttpStatus.BAD_REQUEST,
      );
    }

    const response = await this.linkedInSearchService.searchJobs(
      {
        keywords: keywords || undefined,
        location: body.location?.trim() ? [body.location.trim()] : undefined,
        company: body.company?.trim() ? [body.company.trim()] : undefined,
        date_posted: body.datePosted,
      },
      resolved.accountId,
      { limit },
    );

    const items = response.items
      .filter((item) => item.type === 'JOB')
      .map((item) =>
        this.jobSearchHitTransformer.fromUnipileItem(
          item as unknown as Record<string, unknown>,
        ),
      );

    return {
      status: 'ok',
      dataSource: resolved.dataSource,
      total: items.length,
      items,
    };
  }
}
