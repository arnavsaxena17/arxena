import { Injectable, Logger } from '@nestjs/common';

import { TitleTaxonomyRemoteService } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';
import { extractTitleTermsFromBooleanQuery } from 'src/engine/core-modules/title-taxonomy/extract-title-terms-from-boolean-query.util';
import { type TitleClass } from 'src/engine/core-modules/title-taxonomy/title-class.type';

export type ResolvedRoles = {
  // Titles to search with: the roles as typed, then the taxonomy's titles
  searchTitles: string[];
  // What the requested roles are, per the taxonomy; empty when it has no answer
  requestedClasses: TitleClass[];
  taxonomyAvailable: boolean;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CURATED_GRADE_FALLBACK = 'leadership';

const UNCLASSIFIED = 'unclassified';

type CacheEntry<TValue> = { value: TValue; storedAt: number };

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
  private readonly curatedTitlesCache = new Map<
    string,
    CacheEntry<string[]>
  >();

  constructor(
    private readonly titleTaxonomyRemoteService: TitleTaxonomyRemoteService,
  ) {}

  async resolveRoles(roles: string[]): Promise<ResolvedRoles> {
    const classes = await this.classifyTitles(roles);

    if (classes === null) {
      return {
        searchTitles: this.unique(roles),
        requestedClasses: [],
        taxonomyAvailable: false,
      };
    }

    const requestedClasses = this.uniqueClasses(
      [...classes.values()].filter(
        (titleClass): titleClass is TitleClass => titleClass !== null,
      ),
    );
    const curatedTitles = await Promise.all(
      requestedClasses.map((titleClass) =>
        this.getCuratedTitles(titleClass),
      ),
    );

    return {
      searchTitles: this.unique([...roles, ...curatedTitles.flat()]),
      requestedClasses,
      taxonomyAvailable: true,
    };
  }

  // The titles as typed plus the curated titles of the function and grade they
  // fall in. Titles the taxonomy cannot classify, or whose function has no plain
  // title list, come back unchanged.
  async expandTitles(
    titles: string[],
    { maxTitles = 12 }: { maxTitles?: number } = {},
  ): Promise<{ titles: string[]; added: string[]; taxonomyAvailable: boolean }> {
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

    const responses = await this.titleTaxonomyRemoteService.classifyTitles(missing);

    if (responses === null || responses.length !== missing.length) {
      this.logger.warn(
        'Job title taxonomy unavailable; falling back to the roles as typed',
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
              functionRoot: response.function_root?.id?.trim().toLowerCase() ?? null,
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

  private async getCuratedTitles(titleClass: TitleClass): Promise<string[]> {
    const root = titleClass.functionRoot ?? titleClass.functionId;
    const grade = titleClass.grade ?? CURATED_GRADE_FALLBACK;
    const key = `${root}|${grade}`;
    const cached = this.curatedTitlesCache.get(key);

    if (cached !== undefined && Date.now() - cached.storedAt < CACHE_TTL_MS) {
      return cached.value;
    }

    const response = await this.titleTaxonomyRemoteService.getManualBooleanQueries({
      kind: 'std_function_root',
      label: root,
      stdGrade: grade,
    });

    if (response === null) {
      return [];
    }

    const titles = (response.items ?? []).flatMap((item) =>
      extractTitleTermsFromBooleanQuery(item.boolean_query ?? ''),
    );

    this.curatedTitlesCache.set(key, { value: titles, storedAt: Date.now() });

    return titles;
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
        values.map((value) => value.trim().toLowerCase()).filter((v) => v !== ''),
      ),
    ];
  }
}
