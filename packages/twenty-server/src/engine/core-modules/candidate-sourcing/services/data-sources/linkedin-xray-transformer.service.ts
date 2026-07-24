import { Injectable } from '@nestjs/common';

import type { LinkedInPeopleSearchResult } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-response.type';
import { UserProfile } from 'twenty-shared';

import {
  LinkedInSearchTransformerService,
  TransformedCandidateForTable,
} from './linkedin-search-transformer.service';
import {
  BaseDataSourceTransformerService,
  TransformationContext,
} from './base-data-source-transformer.service';
import { DataProcessingUtils } from '../../utils/data-processing.utils';

const LINKEDIN_XRAY_TABLE_JOB_ID = 'linkedin_xray_job';
const LINKEDIN_XRAY_TABLE_JOB_NAME = 'LinkedIn X-Ray Search Results';

@Injectable()
export class LinkedinXrayTransformerService extends BaseDataSourceTransformerService {
  constructor(
    dataProcessingUtils: DataProcessingUtils,
    private readonly linkedInSearchTransformer: LinkedInSearchTransformerService,
  ) {
    super(dataProcessingUtils);
  }

  getDataSourceIdentifier(): string {
    return 'linkedin_xray';
  }

  transformToUserProfile(
    candidateData: LinkedInPeopleSearchResult,
    context: TransformationContext,
  ): UserProfile {
    return this.linkedInSearchTransformer.transformToUserProfile(
      candidateData,
      {
        ...context,
        dataSource: this.getDataSourceIdentifier(),
      },
    );
  }

  transformLinkedinXrayRowsToTableFormat(
    items: LinkedInPeopleSearchResult[],
    options: {
      companyName: string;
      companyId?: string;
      companyLinkedinUrl?: string;
    },
  ): TransformedCandidateForTable[] {
    if (!items.length) {
      return [];
    }

    const tableRows =
      this.linkedInSearchTransformer.transformSearchResultsToTableFormat(
        items,
        LINKEDIN_XRAY_TABLE_JOB_ID,
        LINKEDIN_XRAY_TABLE_JOB_NAME,
      );

    const withMetadata =
      this.linkedInSearchTransformer.addMetadataToCandidates(tableRows, {
        searchType: 'xray',
        searchCategory: 'people',
        timestamp: new Date().toISOString(),
        processingTime: 0,
      });

    const normalizedCompanyName = options.companyName.trim();
    const normalizedCompanyLinkedinUrl = options.companyLinkedinUrl?.trim();

    return withMetadata.map((row) => ({
      ...row,
      source: 'linkedin_xray',
      campaign: 'linkedin_xray_people',
      company: normalizedCompanyName || row.company,
      jobCompanyName: normalizedCompanyName || row.jobCompanyName,
      ...(options.companyId?.trim()
        ? { jobCompanyId: options.companyId.trim() }
        : {}),
      ...(normalizedCompanyLinkedinUrl
        ? { jobCompanyLinkedinUrl: normalizedCompanyLinkedinUrl }
        : {}),
    }));
  }
}
