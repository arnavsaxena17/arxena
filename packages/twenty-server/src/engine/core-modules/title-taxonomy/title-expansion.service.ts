import { Injectable, Logger } from '@nestjs/common';

import { TitleTaxonomyRemoteService } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';
import { type TitleClass } from 'src/engine/core-modules/title-taxonomy/title-class.type';
import { titleFamilyFallbackTitles } from 'src/engine/core-modules/title-taxonomy/title-family-fallback.util';

export type ResolvedRoles = {
  // Titles to search with: the roles as typed, then the taxonomy's titles
  searchTitles: string[];
  // What the requested roles are, per the taxonomy; empty when it has no answer
  requestedClasses: TitleClass[];
  taxonomyAvailable: boolean;
  // The curated boolean query for each requested function x grade. Sources
  // that understand a boolean title filter (Bright Data, Harvest, Sales Nav)
  // use these instead of a list of words, so "VP Manufacturing" matches the
  // same class as "Head of Manufacturing".
  titleExpressions?: string[];
  // The same queries OR-ed, for a single boolean field
  booleanTitleExpression?: string;
  // The taxonomy class of each role as typed, keyed by lowercased role, so a
  // person can be assigned to the role they actually match
  roleClasses?: Record<string, TitleClass | null>;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CURATED_GRADE_FALLBACK = 'leadership';

const UNCLASSIFIED = 'unclassified';

type CacheEntry<TValue> = { value: TValue; storedAt: number };

type CuratedQueryKind = 'std_function' | 'std_function_root';

// The one place that asks the arxena-site job-title taxonomy (Python) what a
// role is and which titles belong to it, instead of each search path keeping
// its own title lists or asking an LLM
@Injectable()
export class TitleExpansionService {
  private readonly logger = new Logger(TitleExpansionService.name);
  private readonly titleClassCache = new Map<
    string,
    CacheEntry<TitleClass | null>
  >();
  private readonly curatedQueryCache = new Map<
    string,
    CacheEntry<string | null>
  >();
  private readonly similarTitlesCache = new Map<string, CacheEntry<string[]>>();

  constructor(
    private readonly titleTaxonomyRemoteService: TitleTaxonomyRemoteService,
  ) {}

  async resolveRoles(roles: string[]): Promise<ResolvedRoles> {
    const classes = await this.classifyTitles(roles);
    const roleClasses: Record<string, TitleClass | null> = {};

    for (const role of roles) {
      const key = role.trim().toLowerCase();

      roleClasses[key] = classes?.get(key) ?? null;
    }

    if (classes === null) {
      // The taxonomy gives rung 2 its similar titles. Without it, a small
      // curated family list keeps rung 2 working, so "VP Engineering" still
      // searches "Head of Engineering" and "CTO".
      return {
        searchTitles: this.unique(titleFamilyFallbackTitles(roles)),
        requestedClasses: [],
        taxonomyAvailable: false,
        titleExpressions: [],
        booleanTitleExpression: '',
        roleClasses,
      };
    }

    const requestedClasses = this.uniqueClasses(
      [...classes.values()].filter(
        (titleClass): titleClass is TitleClass => titleClass !== null,
      ),
    );
    const queries = await Promise.all(
      requestedClasses.map((titleClass) => this.getCuratedQuery(titleClass)),
    );
    // Keep the operators uppercase: Google and Harvest read AND/OR as words.
    const titleExpressions = [
      ...new Set(
        queries
          .map((query) => query?.trim() ?? '')
          .filter((query) => query.length > 0),
      ),
    ];
    const similarTitles = await Promise.all(
      requestedClasses.map((titleClass) => this.getSimilarTitles(titleClass)),
    );

    return {
      searchTitles: this.unique([...roles, ...similarTitles.flat()]),
      requestedClasses,
      taxonomyAvailable: true,
      titleExpressions,
      booleanTitleExpression: this.combineExpressions(titleExpressions),
      roleClasses,
    };
  }

  // The titles as typed plus the taxonomy's similar titles for the function and
  // grade they fall in, most common in the dataset first. Titles the taxonomy
  // cannot classify come back unchanged.
  async expandTitles(
    titles: string[],
    { maxTitles = 12 }: { maxTitles?: number } = {},
  ): Promise<{
    titles: string[];
    added: string[];
    taxonomyAvailable: boolean;
    booleanTitleExpression: string;
    titleExpressions: string[];
  }> {
    const typed = this.unique(titles);
    const resolved = await this.resolveRoles(typed);
    const expanded = resolved.searchTitles.slice(
      0,
      Math.max(maxTitles, typed.length),
    );

    return {
      titles: expanded,
      added: expanded.filter((title) => !typed.includes(title)),
      taxonomyAvailable: resolved.taxonomyAvailable,
      booleanTitleExpression: resolved.booleanTitleExpression ?? '',
      titleExpressions: resolved.titleExpressions ?? [],
    };
  }

  // Null when the service cannot be reached, so callers can tell "no class"
  // (an entry with null) from "no answer" and fall back to the typed words
  async classifyTitles(
    titles: string[],
  ): Promise<Map<string, TitleClass | null> | null> {
    const wanted = this.unique(titles);
    const result = new Map<string, TitleClass | null>();
    const missing: string[] = [];

    for (const title of wanted) {
      const cached = this.titleClassCache.get(title);

      if (cached !== undefined && Date.now() - cached.storedAt < CACHE_TTL_MS) {
        result.set(title, cached.value);
      } else {
        missing.push(title);
      }
    }

    if (missing.length === 0) {
      return result;
    }

    const responses =
      await this.titleTaxonomyRemoteService.classifyTitles(missing);

    if (responses === null || responses.length !== missing.length) {
      this.logger.warn(
        'Job title taxonomy unavailable; using the roles as typed plus their curated family titles',
      );

      return null;
    }

    responses.forEach((response, index) => {
      const functionId = response.function?.id?.trim().toLowerCase() ?? '';
      const titleClass: TitleClass | null =
        response.function_matched === true &&
        functionId !== '' &&
        functionId !== UNCLASSIFIED
          ? {
              functionId,
              functionRoot:
                response.function_root?.id?.trim().toLowerCase() ?? null,
              grade: response.grade?.id?.trim().toLowerCase() ?? null,
            }
          : null;

      this.titleClassCache.set(missing[index], {
        value: titleClass,
        storedAt: Date.now(),
      });
      result.set(missing[index], titleClass);
    });

    return result;
  }

  // The curated boolean query for a function x grade pair, straight from the
  // arxena-site taxonomy. The specific function is preferred over its root:
  // "manufacturing" has a clean manufacturing query, while the engineering
  // root would also match engineers.
  private async getCuratedQuery(
    titleClass: TitleClass,
  ): Promise<string | null> {
    const grade = titleClass.grade ?? CURATED_GRADE_FALLBACK;
    const key = `${titleClass.functionId}|${titleClass.functionRoot}|${grade}`;
    const cached = this.curatedQueryCache.get(key);

    if (cached !== undefined && Date.now() - cached.storedAt < CACHE_TTL_MS) {
      return cached.value;
    }

    const specific = await this.fetchCuratedQuery({
      kind: 'std_function',
      label: titleClass.functionId,
      stdGrade: grade,
    });
    const byRoot =
      specific === null &&
      titleClass.functionRoot !== null &&
      titleClass.functionRoot !== titleClass.functionId
        ? await this.fetchCuratedQuery({
            kind: 'std_function_root',
            label: titleClass.functionRoot,
            stdGrade: grade,
          })
        : null;
    const value = specific ?? byRoot;

    this.curatedQueryCache.set(key, { value, storedAt: Date.now() });

    return value;
  }

  private async fetchCuratedQuery({
    kind,
    label,
    stdGrade,
  }: {
    kind: CuratedQueryKind;
    label: string;
    stdGrade: string;
  }): Promise<string | null> {
    const response =
      await this.titleTaxonomyRemoteService.getManualBooleanQueries({
        kind,
        label,
        stdGrade,
      });
    const query = (response?.items ?? [])
      .map((item) => item.boolean_query?.trim() ?? '')
      .find((item) => item.length > 0);

    return query ?? null;
  }

  private async getSimilarTitles(titleClass: TitleClass): Promise<string[]> {
    const key = `${titleClass.functionId}|${titleClass.functionRoot ?? ''}`;
    const cached = this.similarTitlesCache.get(key);

    if (cached !== undefined && Date.now() - cached.storedAt < CACHE_TTL_MS) {
      return cached.value;
    }

    // The taxonomy keeps a plain title list per function (ordered by how often
    // the dataset uses each title), so nothing has to be reverse-engineered out
    // of a boolean expression. That matters for AND filters, which name a role
    // without ever writing it out as a title: "VP Manufacturing" is in the
    // curated expression but is not a title anyone can be searched by.
    const titles =
      (await this.titleTaxonomyRemoteService.getSimilarTitles({
        functionId: titleClass.functionId,
        functionRoot: titleClass.functionRoot ?? undefined,
      })) ?? [];

    this.similarTitlesCache.set(key, { value: titles, storedAt: Date.now() });

    return titles;
  }

  private combineExpressions(expressions: string[]): string {
    return expressions.map((expression) => `(${expression})`).join(' OR ');
  }

  private uniqueClasses(classes: TitleClass[]): TitleClass[] {
    const seen = new Set<string>();

    return classes.filter((titleClass) => {
      const key = `${titleClass.functionRoot}|${titleClass.functionId}|${titleClass.grade}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    });
  }

  private unique(values: string[]): string[] {
    return [
      ...new Set(
        values
          .map((value) => value.trim().toLowerCase())
          .filter((v) => v !== ''),
      ),
    ];
  }
}
