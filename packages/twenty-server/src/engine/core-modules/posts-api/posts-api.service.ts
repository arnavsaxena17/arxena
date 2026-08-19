import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

import { LinkedInSearchService } from 'src/engine/core-modules/linkedin-search/services/linkedin-search.service';
import { UnipileSearchAccountResolver } from 'src/engine/core-modules/linkedin-search/services/unipile-search-account.resolver';
import { HarvestLinkedinService } from 'src/engine/core-modules/org-chart/services/harvest-linkedin.service';

import {
  POST_DATA_SOURCE_CATEGORIES,
  type PostDataSourceAlias,
} from './constants/post-data-source-aliases';
import type { PostSearchDto } from './dto/post-search.dto';
import type {
  PostDataSourcesStatusResponse,
  PostSearchResponse,
} from './posts-api.types';
import { PostSearchDataSourceResolver } from './services/post-search-data-source.resolver';
import { PostSearchHitTransformer } from './services/post-search-hit.transformer';

const HARVEST_POSTED_LIMIT_BY_DATE_POSTED: Record<string, string> = {
  past_day: '24h',
  past_week: 'week',
  past_month: 'month',
};

const mapDatePostedToHarvestPostedLimit = (
  datePosted?: string,
): string | undefined => {
  if (!datePosted) {
    return undefined;
  }

  return HARVEST_POSTED_LIMIT_BY_DATE_POSTED[datePosted];
};

@Injectable()
export class PostsApiService {
  constructor(
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly harvestLinkedinService: HarvestLinkedinService,
    private readonly unipileSearchAccountResolver: UnipileSearchAccountResolver,
    private readonly postSearchDataSourceResolver: PostSearchDataSourceResolver,
    private readonly postSearchHitTransformer: PostSearchHitTransformer,
  ) {}

  getDataSourcesStatus(): PostDataSourcesStatusResponse {
    const unipileConfigured =
      this.unipileSearchAccountResolver.isUnipileConfigured();
    const harvestConfigured = this.harvestLinkedinService.isConfigured();
    const configuredByAlias: Record<PostDataSourceAlias, boolean> = {
      auto: unipileConfigured || harvestConfigured,
      harvest: harvestConfigured,
      unipile: unipileConfigured,
      pool: unipileConfigured,
      recruiter: unipileConfigured,
    };

    return {
      status: 'ok',
      sources: POST_DATA_SOURCE_CATEGORIES.map((category) => ({
        alias: category.alias,
        label: category.label,
        description: category.description,
        configured: configuredByAlias[category.alias],
      })),
    };
  }

  async searchPosts(
    body: PostSearchDto,
    apiToken?: string,
  ): Promise<PostSearchResponse> {
    const resolved = await this.postSearchDataSourceResolver.resolve({
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

      const result = await this.harvestLinkedinService.searchPosts({
        search: keywords,
        postedLimit: mapDatePostedToHarvestPostedLimit(body.datePosted),
        sortBy: body.sortBy,
        contentType: body.contentType,
        limit,
      });

      return {
        status: 'ok',
        dataSource: 'harvest',
        total: result.total,
        items: result.items.map((item) =>
          this.postSearchHitTransformer.fromHarvestItem(item),
        ),
      };
    }

    if (!resolved.accountId) {
      throw new HttpException(
        'A LinkedIn Unipile account is required for this post search data source',
        HttpStatus.BAD_REQUEST,
      );
    }

    const response = await this.linkedInSearchService.searchPosts(
      {
        keywords: keywords || undefined,
        sort_by: body.sortBy,
        date_posted: body.datePosted,
        content_type: body.contentType,
      },
      resolved.accountId,
      { limit },
    );

    const items = this.postSearchHitTransformer.fromUnipileItems(
      response.items as Array<{ type?: string } & Record<string, unknown>>,
    );

    return {
      status: 'ok',
      dataSource: resolved.dataSource,
      total: items.length,
      items,
    };
  }
}
