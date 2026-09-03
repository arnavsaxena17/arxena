import { Injectable, Logger } from '@nestjs/common';

export type TitleTaxonomyItem = {
  id: string;
  label: string;
  name: string;
  parent_id: string | null;
  level: string | number | null;
};

export type TitleTaxonomyManualBooleanQueryItem = {
  kind: string;
  label: string;
  std_grade: string;
  boolean_query: string;
  keywords?: string;
};

export type TitleTaxonomyManualBooleanQueriesResponse = {
  status?: string;
  count?: number;
  found?: boolean;
  items?: TitleTaxonomyManualBooleanQueryItem[];
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

export type TitleTaxonomySliceResponse = {
  function_root?: string;
  functions?: TitleTaxonomyItem[];
  grades?: TitleTaxonomyItem[];
};

export type TitleTaxonomyLlmClassification = {
  title?: string;
  profile?: string | null;
  job_title_normalized?: string;
  function_root?: string;
  std_function_root?: string;
  std_function?: string;
  std_grade?: string;
  std_grade_category?: string;
  grade_level?: string;
  function_root_confidence?: number;
  std_function_confidence?: number;
  std_grade_confidence?: number;
  source?: string;
};

export type TitleTaxonomyClassifyLlmResponse = {
  classifications?: TitleTaxonomyLlmClassification[];
  error?: string;
};

export type TitleTaxonomyClassifyResponse = {
  title: string;
  normalized_title: string;
  function_root: TitleTaxonomyItem | null;
  function: TitleTaxonomyItem | null;
  grade: TitleTaxonomyItem | null;
  confidence: number;
  function_matched?: boolean;
  grade_matched?: boolean;
  inference?: {
    used_history?: boolean;
    titles_considered?: string[];
    function_source?: string;
    grade_source?: string;
    grade_inferred?: boolean;
  };
};

export type TitleTaxonomyProfileExperience = {
  title?: string | { name?: string | null } | null;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
};

export type TitleTaxonomyClassifyProfileInput = {
  jobTitle: string;
  experience?: TitleTaxonomyProfileExperience[];
};

/** Must stay in sync with arxena-site `/api/title-taxonomy/classify-titles`. */
export const TITLE_TAXONOMY_CLASSIFY_TITLES_MAX = 200;

/** Must stay in sync with arxena-site `/api/title-taxonomy/classify-profiles`. */
export const TITLE_TAXONOMY_CLASSIFY_PROFILES_MAX = 500;

/** Must stay in sync with arxena-site `/api/llm-classifier/classify`. */
export const TITLE_TAXONOMY_CLASSIFY_LLM_MAX = 200;

const chunkArray = <T>(items: T[], size: number): T[][] => {
  if (items.length === 0) {
    return [];
  }

  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
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

  async getFunctionRoots(
    title?: string,
  ): Promise<TitleTaxonomyItem[] | TitleTaxonomyItem | null> {
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

  async classifyTitles(
    titles: string[],
  ): Promise<TitleTaxonomyClassifyResponse[] | null> {
    if (titles.length === 0) {
      return [];
    }

    const classifiedChunks = await Promise.all(
      chunkArray(titles, TITLE_TAXONOMY_CLASSIFY_TITLES_MAX).map((chunk) =>
        this.classifyTitlesChunk(chunk),
      ),
    );

    if (classifiedChunks.some((chunk) => chunk === null)) {
      return null;
    }

    return classifiedChunks.flatMap((chunk) => chunk ?? []);
  }

  private async classifyTitlesChunk(
    titles: string[],
  ): Promise<TitleTaxonomyClassifyResponse[] | null> {
    const url = `${this.getBaseUrl()}/api/title-taxonomy/classify-titles`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ titles }),
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `Title taxonomy classify-titles returned ${response.status}: ${text}`,
        );
        return null;
      }
      const json = (await response.json()) as {
        items?: TitleTaxonomyClassifyResponse[];
      };
      return Array.isArray(json.items) ? json.items : [];
    } catch (error) {
      this.logger.warn(
        `Title taxonomy classify-titles failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private mapExperienceForPython(
    experience?: TitleTaxonomyProfileExperience[],
  ) {
    return (experience ?? []).map((entry) => {
      const rawTitle = entry.title;
      const title =
        typeof rawTitle === 'string'
          ? rawTitle
          : rawTitle && typeof rawTitle === 'object'
            ? rawTitle.name
            : undefined;
      return {
        title,
        start_date: entry.start_date ?? entry.startDate ?? null,
        end_date: entry.end_date ?? entry.endDate ?? null,
        is_current: entry.is_current ?? entry.isCurrent ?? false,
      };
    });
  }

  async classifyProfile(
    input: TitleTaxonomyClassifyProfileInput,
  ): Promise<TitleTaxonomyClassifyResponse | null> {
    const jobTitle = input.jobTitle.trim();
    if (!jobTitle) {
      return null;
    }
    const url = `${this.getBaseUrl()}/api/title-taxonomy/classify-profile`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_title: jobTitle,
          experience: this.mapExperienceForPython(input.experience),
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `Title taxonomy classify-profile returned ${response.status}: ${text}`,
        );
        return null;
      }
      return (await response.json()) as TitleTaxonomyClassifyResponse;
    } catch (error) {
      this.logger.warn(
        `Title taxonomy classify-profile failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async classifyProfiles(
    profiles: TitleTaxonomyClassifyProfileInput[],
  ): Promise<TitleTaxonomyClassifyResponse[] | null> {
    if (profiles.length === 0) {
      return [];
    }

    const classifiedChunks = await Promise.all(
      chunkArray(profiles, TITLE_TAXONOMY_CLASSIFY_PROFILES_MAX).map((chunk) =>
        this.classifyProfilesChunk(chunk),
      ),
    );

    if (classifiedChunks.some((chunk) => chunk === null)) {
      return null;
    }

    return classifiedChunks.flatMap((chunk) => chunk ?? []);
  }

  private async classifyProfilesChunk(
    profiles: TitleTaxonomyClassifyProfileInput[],
  ): Promise<TitleTaxonomyClassifyResponse[] | null> {
    const url = `${this.getBaseUrl()}/api/title-taxonomy/classify-profiles`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profiles: profiles.map((profile) => ({
            job_title: profile.jobTitle,
            experience: this.mapExperienceForPython(profile.experience),
          })),
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `Title taxonomy classify-profiles returned ${response.status}: ${text}`,
        );
        return null;
      }
      const json = (await response.json()) as {
        items?: TitleTaxonomyClassifyResponse[];
      };
      return Array.isArray(json.items) ? json.items : [];
    } catch (error) {
      this.logger.warn(
        `Title taxonomy classify-profiles failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async getManualBooleanQueries(query?: {
    kind?: string;
    label?: string;
    stdGrade?: string;
    stdFunction?: string;
    stdFunctionRoot?: string;
    includeEmpty?: boolean;
  }): Promise<TitleTaxonomyManualBooleanQueriesResponse | null> {
    return this.fetchTitleTaxonomyJson<TitleTaxonomyManualBooleanQueriesResponse>(
      '/api/title-taxonomy/manual-boolean-queries',
      {
        kind: query?.kind,
        label: query?.label,
        std_grade: query?.stdGrade,
        std_function: query?.stdFunction,
        std_function_root: query?.stdFunctionRoot,
        include_empty: query?.includeEmpty ? 'true' : undefined,
      },
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

  async getTaxonomySlice(
    functionRoot: string,
  ): Promise<TitleTaxonomySliceResponse | null> {
    return this.fetchTitleTaxonomyJson<TitleTaxonomySliceResponse>(
      '/api/title-taxonomy/slice',
      { function_root: functionRoot },
    );
  }

  async classifyLlm(input: {
    jobTitles?: string[];
    profiles?: string[];
  }): Promise<TitleTaxonomyClassifyLlmResponse | null> {
    if (
      (input.jobTitles?.length ?? 0) > TITLE_TAXONOMY_CLASSIFY_LLM_MAX ||
      (input.profiles?.length ?? 0) > TITLE_TAXONOMY_CLASSIFY_LLM_MAX
    ) {
      this.logger.warn(
        `LLM classifier classify rejected: more than ${TITLE_TAXONOMY_CLASSIFY_LLM_MAX} items`,
      );
      return null;
    }

    const url = `${this.getBaseUrl()}/api/llm-classifier/classify`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(input.jobTitles !== undefined
            ? { job_titles: input.jobTitles }
            : {}),
          ...(input.profiles !== undefined ? { profiles: input.profiles } : {}),
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `LLM classifier classify returned ${response.status}: ${text}`,
        );
        return null;
      }
      return (await response.json()) as TitleTaxonomyClassifyLlmResponse;
    } catch (error) {
      this.logger.warn(
        `LLM classifier classify failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
