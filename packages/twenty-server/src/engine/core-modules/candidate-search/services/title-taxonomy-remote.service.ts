import { Injectable, Logger } from '@nestjs/common';

export type TitleTaxonomySearchKeywordsResponse = {
  query?: string;
  boolean_query?: string;
  company_name?: string | null;
  keyword_groups?: Array<{
    type?: string;
    terms?: string[];
    clause?: string;
  }>;
  search_query_set?: unknown;
};

@Injectable()
export class TitleTaxonomyRemoteService {
  private readonly logger = new Logger(TitleTaxonomyRemoteService.name);

  private getBaseUrl(): string {
    const url =
      process.env.ARXENA_SITE_ORGCHART_URL ??
      process.env.ARXENA_SITE_URL ??
      'http://localhost:5050';
    return url.replace(/\/api\/orgchart\/build\/?$/, '').replace(/\/+$/, '');
  }

  /**
   * POST /api/title-taxonomy/search-keywords — deterministic truth-table terms (Python).
   * Optional `resolvedIntent` passes Nest-structured fields; LLM intent stays in Nest only.
   */
  async searchKeywordsFromQuery(input: {
    query: string;
    companyName?: string;
    maxPrimaryTerms?: number;
    maxModifierTerms?: number;
    /** Structured intent from Nest LLM — skips Python heuristics when present. */
    resolvedIntent?: Record<string, unknown>;
  }): Promise<TitleTaxonomySearchKeywordsResponse | null> {
    const url = `${this.getBaseUrl()}/api/title-taxonomy/search-keywords`;
    try {
      const body: Record<string, unknown> = {
        query: input.query,
        company_name: input.companyName,
        max_primary_terms: input.maxPrimaryTerms ?? 6,
        max_modifier_terms: input.maxModifierTerms ?? 2,
      };
      if (input.resolvedIntent !== undefined) {
        body.resolved_intent = input.resolvedIntent;
      }
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `Title taxonomy search-keywords returned ${response.status}: ${text}`,
        );
        return null;
      }
      return (await response.json()) as TitleTaxonomySearchKeywordsResponse;
    } catch (error) {
      this.logger.warn(
        `Title taxonomy search-keywords failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
