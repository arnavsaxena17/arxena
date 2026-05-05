import { Injectable, Logger } from '@nestjs/common';

import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import {
    buildGoogleLinkedinCompanySearchUrl,
    extractLinkedinCompanyCandidatesFromSerpOrganic,
} from 'src/engine/core-modules/linkedin-company-search/utils/linkedin-company-from-serp.util';

export type ResolveLinkedinCompanyInput = {
  companyName: string;
  country?: string;
};

export type ResolveLinkedinCompanyResult = {
  inputCompanyName: string;
  country: string;
  searchUrl: string;
  companyName: string;
  linkedinCompanyUrl: string;
  linkedinCompanySlug: string;
  confidenceScore: number;
};

@Injectable()
export class LinkedinCompanySearchService {
  private readonly logger = new Logger(LinkedinCompanySearchService.name);

  constructor(private readonly brightDataSerpService: BrightDataSerpService) {}

  async resolveLinkedinCompanyUrl(
    input: ResolveLinkedinCompanyInput,
  ): Promise<ResolveLinkedinCompanyResult> {
    const companyName = input.companyName.trim();
    if (!companyName) {
      throw new Error('Company name is required');
    }

    if (!this.brightDataSerpService.isConfigured()) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const country = this.normalizeCountry(input.country);
    const searchUrl = buildGoogleLinkedinCompanySearchUrl({
      companyName,
      country,
    });
    const serp = await this.brightDataSerpService.requestSerpGoogleJson(searchUrl);
    const candidates = extractLinkedinCompanyCandidatesFromSerpOrganic({
      organic: serp.organic,
      targetCompanyName: companyName,
    });

    const bestMatch = candidates[0];
    if (!bestMatch) {
      throw new Error(
        `No LinkedIn company URL found in SERP results for "${companyName}"`,
      );
    }

    this.logger.log(
      `Resolved LinkedIn company for "${companyName}" (${country}) to ${bestMatch.linkedinCompanyUrl} score=${bestMatch.score}`,
    );

    return {
      inputCompanyName: companyName,
      country,
      searchUrl,
      companyName: bestMatch.companyName,
      linkedinCompanyUrl: bestMatch.linkedinCompanyUrl,
      linkedinCompanySlug: bestMatch.linkedinCompanySlug,
      confidenceScore: bestMatch.score,
    };
  }

  private normalizeCountry(rawCountry: string | undefined): string {
    const value = (rawCountry || '').trim();
    if (!value) {
      return 'india';
    }

    if (value.length === 2) {
      const codeMap: Record<string, string> = {
        IN: 'india',
        US: 'united states',
        GB: 'united kingdom',
        UK: 'united kingdom',
        AE: 'united arab emirates',
      };

      return codeMap[value.toUpperCase()] || value.toUpperCase();
    }

    return value.toLowerCase();
  }
}
