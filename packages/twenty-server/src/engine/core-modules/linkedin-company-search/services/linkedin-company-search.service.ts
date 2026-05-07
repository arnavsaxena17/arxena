import { Injectable, Logger } from '@nestjs/common';

import { BrightDataSerpService } from 'src/engine/core-modules/bright-data/services/bright-data-serp.service';
import {
    buildGoogleCompanyWebsiteSearchUrl,
    buildGoogleLinkedinCompanySearchUrl,
    extractCompanyWebsiteCandidatesFromSerpOrganic,
    extractLinkedinCompanyCandidatesFromSerpOrganic,
} from 'src/engine/core-modules/linkedin-company-search/utils/linkedin-company-from-serp.util';
import { LLMChatModelService } from 'src/engine/core-modules/llm-chat-model/llm-chat-model.service';

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

export type ResolveCompanyWebsiteResult = {
  inputCompanyName: string;
  country: string;
  searchUrl: string;
  companyName: string;
  websiteUrl: string;
  domain: string;
  confidenceScore: number;
  selectedBy: 'ranking' | 'llm';
};

@Injectable()
export class SerpCompanySearchService {
  private readonly logger = new Logger(SerpCompanySearchService.name);

  constructor(
    private readonly brightDataSerpService: BrightDataSerpService,
    private readonly llmChatModelService: LLMChatModelService,
  ) {}

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

  async resolveCompanyWebsiteDomain(input: {
    companyName: string;
    country?: string;
  }): Promise<ResolveCompanyWebsiteResult> {
    const companyName = input.companyName.trim();
    if (!companyName) {
      throw new Error('Company name is required');
    }

    if (!this.brightDataSerpService.isConfigured()) {
      throw new Error('BRIGHT_DATA_API_KEY is not set');
    }

    const country = this.normalizeCountry(input.country);
    const searchUrl = buildGoogleCompanyWebsiteSearchUrl({
      companyName,
      country,
    });
    const serp = await this.brightDataSerpService.requestSerpGoogleJson(searchUrl);
    const candidates = extractCompanyWebsiteCandidatesFromSerpOrganic({
      organic: serp.organic,
      targetCompanyName: companyName,
    });
    const rankedBestMatch = candidates[0];

    if (!rankedBestMatch) {
      throw new Error(
        `No relevant company website found in SERP results for "${companyName}"`,
      );
    }

    const shouldUseLlm = rankedBestMatch.score < 70 && candidates.length > 1;
    if (!shouldUseLlm) {
      return {
        inputCompanyName: companyName,
        country,
        searchUrl,
        companyName: rankedBestMatch.companyName,
        websiteUrl: rankedBestMatch.websiteUrl,
        domain: rankedBestMatch.domain,
        confidenceScore: rankedBestMatch.score,
        selectedBy: 'ranking',
      };
    }

    const llmSelectedDomain = await this.selectWebsiteDomainWithLlm({
      companyName,
      country,
      candidates: candidates.slice(0, 6).map((candidate) => ({
        companyName: candidate.companyName,
        domain: candidate.domain,
        websiteUrl: candidate.websiteUrl,
        score: candidate.score,
        sourceTitle: candidate.sourceTitle,
      })),
    });

    const llmSelectedCandidate = candidates.find(
      (candidate) => candidate.domain === llmSelectedDomain,
    );
    if (!llmSelectedCandidate) {
      return {
        inputCompanyName: companyName,
        country,
        searchUrl,
        companyName: rankedBestMatch.companyName,
        websiteUrl: rankedBestMatch.websiteUrl,
        domain: rankedBestMatch.domain,
        confidenceScore: rankedBestMatch.score,
        selectedBy: 'ranking',
      };
    }

    return {
      inputCompanyName: companyName,
      country,
      searchUrl,
      companyName: llmSelectedCandidate.companyName,
      websiteUrl: llmSelectedCandidate.websiteUrl,
      domain: llmSelectedCandidate.domain,
      confidenceScore: llmSelectedCandidate.score,
      selectedBy: 'llm',
    };
  }

  private async selectWebsiteDomainWithLlm(input: {
    companyName: string;
    country: string;
    candidates: Array<{
      companyName: string;
      domain: string;
      websiteUrl: string;
      score: number;
      sourceTitle?: string;
    }>;
  }): Promise<string | null> {
    try {
      const model = this.llmChatModelService.getJSONChatModel();
      const prompt = [
        'You are given company website candidates from search results.',
        'Select the most likely official company website domain.',
        'Return strictly valid JSON object with this shape:',
        '{"selectedDomain":"example.com","reason":"short reason"}',
        `Target company: ${input.companyName}`,
        `Country hint: ${input.country}`,
        `Candidates JSON: ${JSON.stringify(input.candidates)}`,
      ].join('\n');
      const response = await model.invoke(prompt);
      const rawContent = this.normalizeLlmResponseContent(response);

      if (!rawContent) {
        return null;
      }

      const parsed = JSON.parse(rawContent) as {
        selectedDomain?: string;
      };
      const selectedDomain = parsed.selectedDomain?.trim().toLowerCase();

      return selectedDomain || null;
    } catch (error) {
      this.logger.warn(
        `Website LLM selection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private normalizeLlmResponseContent(response: unknown): string | null {
    if (
      typeof response === 'object' &&
      response !== null &&
      'content' in response
    ) {
      const content = (response as { content?: unknown }).content;
      if (typeof content === 'string') {
        return content.trim();
      }
      if (Array.isArray(content)) {
        const joined = content
          .map((item) => {
            if (
              typeof item === 'object' &&
              item !== null &&
              'text' in item &&
              typeof (item as { text?: unknown }).text === 'string'
            ) {
              return (item as { text: string }).text;
            }
            return '';
          })
          .join('')
          .trim();
        return joined || null;
      }
    }

    return null;
  }
}
