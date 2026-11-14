import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';

import { LinkedinUnipileSessionService } from 'src/engine/core-modules/arx-chat/services/linkedin-unipile-session.service';
import { LinkedInSearchService } from 'src/domains/discovery/transport/linkedin-search/services/linkedin-search.service';

// LinkedIn's parameter catalogue (locations, industries, schools, ...) plus the
// account a lookup runs as. Both the planner and the org-chart build read these,
// so they live here on the transport rather than in the planning module.
const LINKEDIN_PARAMETER_TYPE_MAP: Record<string, string> = {
  LOCATION: 'LOCATION',
  locations: 'LOCATION',
  location: 'LOCATION',
  INDUSTRY: 'INDUSTRY',
  industries: 'INDUSTRY',
  industry: 'INDUSTRY',
  COMPANY: 'COMPANY',
  companies: 'COMPANY',
  company: 'COMPANY',
  SCHOOL: 'SCHOOL',
  schools: 'SCHOOL',
  school: 'SCHOOL',
  JOB_TITLE: 'JOB_TITLE',
  'job-titles': 'JOB_TITLE',
  'job-title': 'JOB_TITLE',
  SKILL: 'SKILL',
  skills: 'SKILL',
  skill: 'SKILL',
  SAVED_SEARCHES: 'SAVED_SEARCHES',
  'saved-searches': 'SAVED_SEARCHES',
  'saved-search': 'SAVED_SEARCHES',
  RECENT_SEARCHES: 'RECENT_SEARCHES',
  'recent-searches': 'RECENT_SEARCHES',
  'recent-search': 'RECENT_SEARCHES',
};

@Injectable()
export class LinkedinParameterCatalogService {
  private readonly logger = new Logger(LinkedinParameterCatalogService.name);

  constructor(
    private readonly linkedInSearchService: LinkedInSearchService,
    private readonly linkedinUnipileSessionService: LinkedinUnipileSessionService,
  ) {}

  async getLinkedInAccountId(
    apiToken: string,
    explicitAccountId?: string,
  ): Promise<string> {
    try {
      return await this.linkedinUnipileSessionService.ensureLinkedinAccountId(
        apiToken,
        explicitAccountId,
      );
    } catch (error) {
      this.logger.warn(
        `Workspace member LinkedIn Unipile account lookup failed, trying env fallback: ${error}`,
      );
    }

    const envFallback = process.env.UNIPILE_LINKEDIN_ACCOUNT_ID?.trim();
    if (envFallback) {
      this.logger.debug(
        'Using UNIPILE_LINKEDIN_ACCOUNT_ID env fallback for LinkedIn search',
      );
      return envFallback;
    }

    this.logger.error(
      'LinkedIn account ID not found on workspace member profile and no env fallback',
    );
    throw new HttpException(
      'Failed to get LinkedIn account ID',
      HttpStatus.BAD_REQUEST,
    );
  }

  async fetchLinkedInParameters(
    parameterType: string,
    keywords?: string,
    limit?: number,
    apiToken?: string,
  ): Promise<unknown> {
    try {
      const accountId = await this.getLinkedInAccountId(apiToken || '');
      const normalizedParameterType =
        LINKEDIN_PARAMETER_TYPE_MAP[parameterType] ?? parameterType;

      const result = await this.linkedInSearchService.getSearchParameters(
        normalizedParameterType as never,
        accountId,
        { keywords, limit },
      );

      this.logger.log(
        `Fetched ${result.items.length} LinkedIn parameters for type: ${normalizedParameterType}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to fetch LinkedIn parameters for type: ${parameterType}`,
        error,
      );
      throw error;
    }
  }
}
