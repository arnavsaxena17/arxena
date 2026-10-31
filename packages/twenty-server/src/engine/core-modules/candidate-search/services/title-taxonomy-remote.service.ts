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

/**
 * One function x grade boolean at role or family scope. `boolean_query` is the
 * role's own anchor set for `role`, or the whole root subtree for `family`.
 */
export type TitleTaxonomyRoleQueryResponse = {
  status?: string;
  function?: string;
  grade?: string;
  scope?: string;
  terms?: string[];
  grade_terms?: string[];
  boolean_query?: string;
  error?: string;
};

/** Plain titles for one function, ordered by how often the dataset uses them. */
export type TitleTaxonomySimilarTitlesResponse = {
  status?: string;
  title?: string;
  std_function?: string;
  std_function_root?: string;
  std_grade?: string;
  source?: 'std_function' | 'std_function_root' | 'none';
  count?: number;
  titles?: string[];
  boolean_query?: string;
};

/** One whole title from the grade x function lattice. */
export type TitleTaxonomySimilarJobTitleItem = {
  title?: string;
  grade_term?: string;
  // Calibrated years of experience, not the tree depth
  grade_coord?: number;
  function_term?: string;
  term_scope?: string;
  pair_count?: number;
  exact_count?: number;
  cell?: string;
};

/** Titles partitioned by band relation and calibrated year distance. */
export type TitleTaxonomySimilarJobTitleCell = {
  id?: string;
  label?: string;
  count?: number;
  items?: TitleTaxonomySimilarJobTitleItem[];
};

/**
 * Whole titles for one function and seniority. `reason` is set when nothing is
 * returned: unclassified, unknown_function, function_required, index_unavailable.
 */
export type TitleTaxonomySimilarJobTitlesResponse = {
  status?: string;
  title?: string;
  std_function?: string;
  std_function_root?: string;
  std_grade?: string;
  std_grade_term?: string;
  scope?: string;
  bands?: string;
  count?: number;
  titles?: string[];
  cells?: TitleTaxonomySimilarJobTitleCell[];
  boolean_query?: string;
  reason?: string;
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
   * GET /api/title-taxonomy/role-query — the role-scope boolean for one
   * function x grade. `scope=family` returns the department query instead.
   *
   * Null when the service cannot be reached, so the caller can fall back to
   * the function's OR words rather than treating it as "no query".
   */
  async getRoleQuery(query: {
    functionId: string;
    grade?: string;
    scope?: string;
  }): Promise<TitleTaxonomyRoleQueryResponse | null> {
    return this.fetchTitleTaxonomyJson<TitleTaxonomyRoleQueryResponse>(
      '/api/title-taxonomy/role-query',
      {
        function: query.functionId,
        grade: query.grade,
        scope: query.scope,
      },
    );
  }

  /**
   * GET /api/title-taxonomy/similar-titles — every title the taxonomy files
   * under a function (root fallback), most common in the dataset first.
   *
   * Null when the service cannot be reached, so callers can tell "no titles"
   * from "no answer".
   */
  async getSimilarTitles(query: {
    title?: string;
    functionId?: string;
    functionRoot?: string;
    maxTitles?: number;
  }): Promise<string[] | null> {
    const json =
      await this.fetchTitleTaxonomyJson<TitleTaxonomySimilarTitlesResponse>(
        '/api/title-taxonomy/similar-titles',
        {
          title: query.title,
          function: query.functionId,
          function_root: query.functionRoot,
          max_titles:
            query.maxTitles !== undefined ? String(query.maxTitles) : undefined,
        },
      );

    if (json === null) {
      return null;
    }

    return Array.isArray(json.titles) ? json.titles : [];
  }

  /**
   * POST /api/title-taxonomy/keywords — the frequency-ranked OR terms for one
   * function or root, with their job-title counts. This is the same ranking the
   * taxonomy's own boolean query generator uses (`select_leaf_representative_
   * or_terms` / `boolean_query_from_std_function`), so a caller that caps a
   * curated query keeps the terms the dataset uses most.
   *
   * Null when the service cannot be reached, so a caller can fall back to the
   * curated order instead of treating it as "no terms".
   */
  async getRankedKeywords(query: {
    functionId?: string;
    functionRoot?: string;
    maxTerms?: number;
  }): Promise<Array<{ term: string; count: number }> | null> {
    const url = `${this.getBaseUrl()}/api/title-taxonomy/keywords`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function_id: query.functionId,
          function_root: query.functionRoot,
          max_terms: query.maxTerms ?? 12,
        }),
      });

      if (!response.ok) {
        const text = await response.text();

        this.logger.warn(
          `Title taxonomy keywords returned ${response.status}: ${text}`,
        );

        return null;
      }

      const json = (await response.json()) as {
        primary_keywords?: string[];
        synonym_keywords?: string[];
        ranked_terms?: Array<{ term?: string; count?: number }>;
      };
      // ranked_terms carries the counts; primary + synonyms keep the same order
      // when an older service omits it
      const ranked = Array.isArray(json.ranked_terms)
        ? json.ranked_terms
            .map((entry) => ({
              term: typeof entry.term === 'string' ? entry.term.trim() : '',
              count: typeof entry.count === 'number' ? entry.count : 0,
            }))
            .filter((entry) => entry.term !== '')
        : [...(json.primary_keywords ?? []), ...(json.synonym_keywords ?? [])]
            .map((term) => term.trim())
            .filter((term) => term !== '')
            .map((term) => ({ term, count: 0 }));

      return ranked;
    } catch (error) {
      this.logger.warn(
        `Title taxonomy keywords failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return null;
    }
  }

  /**
   * GET /api/title-taxonomy/similar-job-titles — whole titles composed from the
   * grade x function lattice, bucketed by calibrated years of experience.
   *
   * Unlike getSimilarTitles (a function's OR words), this keeps the seniority
   * axis: `bands: 'same'` answers with the titles at the role's own level, so
   * "VP Manufacturing" gets "head of production", not "plant".
   *
   * Null when the service cannot be reached, so callers can tell "no titles"
   * from "no answer". An unreachable service and an empty `titles` list call
   * for different fallbacks, so the response is returned whole.
   */
  async getSimilarJobTitles(query: {
    // The role as typed: it carries the surface grade term ("vp", "head")
    title?: string;
    functionId?: string;
    grade?: string;
    scope?: 'function' | 'root' | 'all';
    bands?: 'same' | 'adjacent' | 'all';
    attestedOnly?: boolean;
    maxTitles?: number;
  }): Promise<TitleTaxonomySimilarJobTitlesResponse | null> {
    return this.fetchTitleTaxonomyJson<TitleTaxonomySimilarJobTitlesResponse>(
      '/api/title-taxonomy/similar-job-titles',
      {
        title: query.title,
        function: query.functionId,
        grade: query.grade,
        scope: query.scope,
        bands: query.bands,
        // Omitted means the index default (attested only); a caller who wants
        // the synthetic shapes has to say so
        attested: query.attestedOnly === false ? 'false' : undefined,
        max_titles:
          query.maxTitles !== undefined ? String(query.maxTitles) : undefined,
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
