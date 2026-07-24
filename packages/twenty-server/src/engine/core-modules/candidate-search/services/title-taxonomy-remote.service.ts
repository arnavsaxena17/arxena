import { Injectable, Logger } from '@nestjs/common';

export type TitleTaxonomyItem = {
  id: string;
  label: string;
  name: string;
  parent_id: string | null;
  level: string | number | null;
};

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

export type TitleTaxonomyClassifyResponse = {
  title: string;
  normalized_title: string;
  function_root: TitleTaxonomyItem | null;
  function: TitleTaxonomyItem | null;
  grade: TitleTaxonomyItem | null;
  confidence: number;
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

  private async fetchTitleTaxonomyJson<T>(
    path: string,
    query?: Record<string, string | undefined>,
  ): Promise<T | null> {
    const params = new URLSearchParams();
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value?.trim()) {
          params.set(key, value.trim());
        }
      }
    }

    const queryString = params.toString();
    const url = `${this.getBaseUrl()}${path}${queryString ? `?${queryString}` : ''}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `Title taxonomy GET ${path} returned ${response.status}: ${text}`,
        );
        return null;
      }
      return (await response.json()) as T;
    } catch (error) {
      this.logger.warn(
        `Title taxonomy GET ${path} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async getFunctionRoots(title?: string): Promise<TitleTaxonomyItem[] | TitleTaxonomyItem | null> {
    const json = await this.fetchTitleTaxonomyJson<
      { items?: TitleTaxonomyItem[] } | TitleTaxonomyItem
    >('/api/title-taxonomy/function-roots', { title });
    if (!json) {
      return [];
    }
    if ('items' in json && Array.isArray(json.items)) {
      return json.items;
    }
    return json as TitleTaxonomyItem;
  }

  async getFunctions(
    functionRoot?: string,
    title?: string,
  ): Promise<TitleTaxonomyItem[] | TitleTaxonomyItem | null> {
    const json = await this.fetchTitleTaxonomyJson<
      { items?: TitleTaxonomyItem[] } | TitleTaxonomyItem
    >('/api/title-taxonomy/functions', {
      function_root: functionRoot,
      title,
    });
    if (!json) {
      return [];
    }
    if ('items' in json && Array.isArray(json.items)) {
      return json.items;
    }
    return json as TitleTaxonomyItem;
  }

  async getGrades(
    gradeLevel?: string,
    title?: string,
  ): Promise<TitleTaxonomyItem[] | TitleTaxonomyItem | null> {
    const json = await this.fetchTitleTaxonomyJson<
      { items?: TitleTaxonomyItem[] } | TitleTaxonomyItem
    >('/api/title-taxonomy/grades', {
      grade_level: gradeLevel,
      title,
    });
    if (!json) {
      return [];
    }
    if ('items' in json && Array.isArray(json.items)) {
      return json.items;
    }
    return json as TitleTaxonomyItem;
  }

  async classifyTitle(
    title: string,
  ): Promise<TitleTaxonomyClassifyResponse | null> {
    const trimmed = title.trim();
    if (!trimmed) {
      return null;
    }

    return this.fetchTitleTaxonomyJson<TitleTaxonomyClassifyResponse>(
      '/api/title-taxonomy/classify-title',
      { title: trimmed },
    );
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
