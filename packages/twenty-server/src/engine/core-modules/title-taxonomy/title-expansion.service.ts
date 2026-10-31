import { Injectable, Logger } from '@nestjs/common';

import { TitleTaxonomyRemoteService } from 'src/engine/core-modules/candidate-search/services/title-taxonomy-remote.service';
import {
  capBooleanExpression,
  DEFAULT_BOOLEAN_TERM_BUDGET,
  GOOGLE_TITLE_TERM_BUDGET,
} from 'src/engine/core-modules/title-taxonomy/boolean-expression-budget.util';
import {
  splitRoleMention,
  toSearchTerms,
} from 'src/engine/core-modules/title-taxonomy/role-mention-split.util';
import { type TitleClass } from 'src/engine/core-modules/title-taxonomy/title-class.type';
import { titleFamilyFallbackTitles } from 'src/engine/core-modules/title-taxonomy/title-family-fallback.util';

export type ResolvedRolePlan = {
  // The atomic role, one designation per function ("Head of Logistics")
  role: string;
  // The phrase the user wrote it in ("Head of Supply Chain / Logistics")
  sourceMention: string;
  titleClass: TitleClass | null;
  // This role's taxonomy equivalents, before the role itself is added
  similarTitles: string[];
  // This role's own titles: the role as typed plus its taxonomy equivalents
  searchTitles: string[];
  // This role's curated function x grade boolean, inside the term budget
  titleExpression: string | null;
  // The same query trimmed to what a Google clause can carry
  googleTitleExpression: string | null;
};

export type RoleQueryScope = 'role' | 'family';

export type ResolvedRoles = {
  // One entry per function the user named, after splitting coordinated mentions
  roles: string[];
  rolePlans: ResolvedRolePlan[];
  // Role = the function the user named; family = its whole root department
  scope: RoleQueryScope;
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
  // The same queries trimmed to Google's clause budget; a >30-word clause is
  // dropped by Google, which is how a root query silently lost its search
  googleTitleExpressions?: string[];
  // The same queries OR-ed, for a single boolean field
  booleanTitleExpression?: string;
  // The taxonomy class of each role as typed, keyed by lowercased role, so a
  // person can be assigned to the role they actually match
  roleClasses?: Record<string, TitleClass | null>;
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CURATED_GRADE_FALLBACK = 'leadership';

// The slice of the calibrated lattice that counts as "the same role": the
// function's own words, same band, inside the peer window (<= 3 years). The
// role is passed as typed so the window is centred on its own years, not on
// the band's median, which would return the whole band.
const SIMILAR_TITLES_MAX = 12;
const SIMILAR_TITLES_BANDS = 'same' as const;
const SIMILAR_TITLES_SCOPE = 'function' as const;

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
  private readonly googleQueryCache = new Map<
    string,
    CacheEntry<string | null>
  >();
  // Term -> rank from the taxonomy's frequency-ranked keywords, per class
  private readonly rankedTermCache = new Map<
    string,
    CacheEntry<Map<string, number>>
  >();
  private readonly similarTitlesCache = new Map<string, CacheEntry<string[]>>();
  // Whole titles from the calibrated lattice, per role: the answer depends on
  // the surface grade term the role carries, so the typed role is part of the
  // key. Only lattice answers are cached here; the OR-word fallback keeps its
  // own cache so a missing artifact is retried on the next call.
  private readonly similarJobTitlesCache = new Map<
    string,
    CacheEntry<string[]>
  >();

  constructor(
    private readonly titleTaxonomyRemoteService: TitleTaxonomyRemoteService,
  ) {}

  // Title filter priority for Bright Data / Harvest / Sales Nav:
  // 1. TitleTaxonomyManualBooleanQueryItem.boolean_query (CSV) → titleExpressions
  // 2. Whole titles from the calibrated lattice (grade x function, ≤3 years)
  // 3. The function's OR words, or the TS family fallback / roles as typed
  async resolveRoles(
    roles: string[],
    { scope }: { scope?: RoleQueryScope } = {},
  ): Promise<ResolvedRoles> {
    // A department phrase is family scope; a named role is role scope. The
    // caller can always override, and role scope never falls back to the root.
    const resolvedScope: RoleQueryScope =
      scope ??
      (/\b(all|every|entire|team|function|department|division)\b/i.test(
        roles.join(' '),
      )
        ? 'family'
        : 'role');
    const mentions = this.uniquePreservingCase(roles);
    // "Head of Supply Chain / Logistics" names two functions. Split it before
    // classifying so each side gets its own class, titles and filter.
    const candidates = this.uniquePreservingCase(
      mentions.flatMap((mention) => splitRoleMention(mention)),
    );
    const classes = await this.classifyTitles(
      this.uniquePreservingCase([...mentions, ...candidates]),
    );
    const { roles: atomicRoles, sourceMentionOf } = this.collapseSplits(
      mentions,
      classes,
    );
    const roleClasses: Record<string, TitleClass | null> = {};

    for (const role of atomicRoles) {
      const key = role.trim().toLowerCase();

      roleClasses[key] = classes?.get(key) ?? null;
    }

    if (classes === null) {
      // The taxonomy gives rung 2 its similar titles. Without it, a small
      // curated family list keeps rung 2 working, so "VP Engineering" still
      // searches "Head of Engineering" and "CTO".
      const searchTitles = this.unique(
        toSearchTerms(titleFamilyFallbackTitles(atomicRoles)),
      );

      this.logger.log(
        `Title taxonomy unavailable; family fallback titles for [${atomicRoles.join(', ')}]: ${searchTitles.join(', ')}`,
      );

      return {
        roles: atomicRoles,
        rolePlans: atomicRoles.map((role) => ({
          role,
          sourceMention: sourceMentionOf.get(role) ?? role,
          titleClass: null,
          similarTitles: [],
          // The TS family keeps rung 2 working when the taxonomy is down
          searchTitles: this.unique(
            toSearchTerms(titleFamilyFallbackTitles([role])),
          ),
          titleExpression: null,
          googleTitleExpression: null,
        })),
        scope: resolvedScope,
        searchTitles,
        requestedClasses: [],
        taxonomyAvailable: false,
        titleExpressions: [],
        googleTitleExpressions: [],
        booleanTitleExpression: '',
        roleClasses,
      };
    }

    const requestedClasses = this.uniqueClasses(
      atomicRoles
        .map((role) => roleClasses[role.trim().toLowerCase()] ?? null)
        .filter((titleClass): titleClass is TitleClass => titleClass !== null),
    );
    // One lookup per class, not per role: "Procurement Head" and "CPO" share a
    // class and must not each fetch and cap the same query
    const expressionsByClass = new Map<
      string,
      { provider: string | null; google: string | null }
    >();

    await Promise.all(
      requestedClasses.map(async (titleClass) => {
        const provider = await this.getCuratedQuery(titleClass, resolvedScope);
        const google =
          provider === null
            ? null
            : await this.getGoogleQuery(titleClass, resolvedScope);

        expressionsByClass.set(this.classKey(titleClass), { provider, google });
      }),
    );

    const rolePlans = await Promise.all(
      atomicRoles.map(async (role): Promise<ResolvedRolePlan> => {
        const titleClass = roleClasses[role.trim().toLowerCase()] ?? null;
        const similarTitles = await this.getSimilarTitles(
          role.trim().toLowerCase(),
          titleClass,
        );
        const expression =
          titleClass === null
            ? undefined
            : expressionsByClass.get(this.classKey(titleClass));

        return {
          role,
          sourceMention: sourceMentionOf.get(role) ?? role,
          titleClass,
          similarTitles,
          searchTitles: this.unique(toSearchTerms([role, ...similarTitles])),
          titleExpression: expression?.provider ?? null,
          googleTitleExpression: expression?.google ?? null,
        };
      }),
    );
    // Keep the operators uppercase: Google and Harvest read AND/OR as words.
    const titleExpressions = [
      ...new Set(
        rolePlans
          .map((plan) => plan.titleExpression?.trim() ?? '')
          .filter((query) => query.length > 0),
      ),
    ];
    const googleTitleExpressions = [
      ...new Set(
        rolePlans
          .map((plan) => plan.googleTitleExpression?.trim() ?? '')
          .filter((query) => query.length > 0),
      ),
    ];
    const booleanTitleExpression = this.capCombinedExpression(
      this.combineExpressions(titleExpressions),
    );

    if (titleExpressions.length > 0) {
      this.logger.log(
        `Using manual boolean title filter(s) for [${atomicRoles.join(', ')}]: ${booleanTitleExpression}`,
      );
    } else if (requestedClasses.length > 0) {
      this.logger.log(
        `No manual boolean for [${atomicRoles.join(', ')}]; using similar titles only`,
      );
    }

    return {
      roles: atomicRoles,
      rolePlans,
      scope: resolvedScope,
      // Interleaved so a caller that caps the list (find_people_by_company keeps
      // 8) still sees every role it asked for, instead of the first role's 12
      searchTitles: this.unique(
        toSearchTerms([
          ...atomicRoles,
          ...this.interleave(rolePlans.map((plan) => plan.similarTitles)),
        ]),
      ),
      requestedClasses,
      taxonomyAvailable: true,
      titleExpressions,
      googleTitleExpressions,
      booleanTitleExpression,
      roleClasses,
    };
  }

  // Keeps a split only when the parts are really different functions. The
  // taxonomy answers that, so "Health & Safety" (one function) stays whole
  // while "Supply Chain / Logistics" (two) splits.
  private collapseSplits(
    mentions: string[],
    classes: Map<string, TitleClass | null> | null,
  ): { roles: string[]; sourceMentionOf: Map<string, string> } {
    const roles: string[] = [];
    const sourceMentionOf = new Map<string, string>();

    for (const mention of mentions) {
      const parts = splitRoleMention(mention);
      const kept =
        parts.length < 2 || classes === null
          ? [mention]
          : this.partsNameDifferentFunctions(parts, classes)
            ? parts
            : [mention];

      for (const role of kept) {
        const trimmed = role.trim().replace(/\s+/g, ' ');
        const existing = roles.find(
          (candidate) => candidate.toLowerCase() === trimmed.toLowerCase(),
        );

        if (existing === undefined) {
          roles.push(trimmed);
          sourceMentionOf.set(trimmed, mention);
        }
      }

      if (kept.length > 1) {
        this.logger.log(
          `Split role mention "${mention}" into [${kept.join(', ')}]`,
        );
      }
    }

    return { roles, sourceMentionOf };
  }

  private partsNameDifferentFunctions(
    parts: string[],
    classes: Map<string, TitleClass | null>,
  ): boolean {
    const functionIds = new Set(
      parts
        .map((part) => classes.get(part.trim().toLowerCase())?.functionId)
        .filter((functionId): functionId is string => functionId !== undefined),
    );

    return functionIds.size >= 2;
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
  // arxena-site taxonomy. Role scope prefers the function ("manufacturing" has
  // a clean query; the engineering root would also match engineers); family
  // scope prefers the root subtree.
  private async getCuratedQuery(
    titleClass: TitleClass,
    scope: RoleQueryScope = 'role',
  ): Promise<string | null> {
    const grade = titleClass.grade ?? CURATED_GRADE_FALLBACK;
    const key = `${titleClass.functionId}|${titleClass.functionRoot}|${grade}|${scope}`;
    const cached = this.curatedQueryCache.get(key);

    if (cached !== undefined && Date.now() - cached.storedAt < CACHE_TTL_MS) {
      return cached.value;
    }

    // A root is a container, not the role. Family/coverage scope prefers the
    // root subtree; role scope prefers the function's own curated query and
    // never the children. The taxonomy role query is the last fallback when
    // neither CSV row exists.
    const byRoot =
      scope === 'family' && titleClass.functionRoot !== null
        ? await this.fetchCuratedQuery({
            kind: 'std_function_root',
            label: titleClass.functionRoot,
            stdGrade: grade,
          })
        : null;
    const specific =
      byRoot === null
        ? await this.fetchCuratedQuery({
            kind: 'std_function',
            label: titleClass.functionId,
            stdGrade: grade,
          })
        : null;
    const byRole =
      specific === null && byRoot === null
        ? await this.fetchRoleQuery(titleClass, grade, scope)
        : null;
    const value = byRoot ?? specific ?? byRole;
    const capped =
      value === null
        ? null
        : await this.capExpression(value, titleClass, 'provider');

    this.curatedQueryCache.set(key, { value: capped, storedAt: Date.now() });

    return capped;
  }

  // The same curated query, trimmed to what a Google clause can carry. Google
  // drops a clause over ~30 words outright, so a root query was vanishing
  // instead of being shortened.
  private async getGoogleQuery(
    titleClass: TitleClass,
    scope: RoleQueryScope = 'role',
  ): Promise<string | null> {
    const key = `${titleClass.functionId}|${titleClass.functionRoot ?? ''}|${titleClass.grade ?? ''}|${scope}|google`;
    const cached = this.googleQueryCache.get(key);

    if (cached !== undefined && Date.now() - cached.storedAt < CACHE_TTL_MS) {
      return cached.value;
    }

    const expression = await this.getCuratedQuery(titleClass, scope);
    const value =
      expression === null
        ? null
        : await this.capExpression(expression, titleClass, 'google');

    this.googleQueryCache.set(key, { value, storedAt: Date.now() });

    return value;
  }

  private async capExpression(
    expression: string,
    titleClass: TitleClass,
    target: 'provider' | 'google',
  ): Promise<string> {
    const budget =
      target === 'google'
        ? GOOGLE_TITLE_TERM_BUDGET
        : DEFAULT_BOOLEAN_TERM_BUDGET;
    const rankOf = await this.getTermRank(titleClass);
    const capped = capBooleanExpression({ expression, rankOf, budget });

    if (capped.droppedTerms.length > 0) {
      this.logger.log(
        `Capped ${titleClass.functionId}/${titleClass.grade ?? 'unknown'} ${target} filter to ${budget.maxTerms} terms: dropped ${capped.droppedTerms.join(', ')}`,
      );
    }

    return capped.expression;
  }

  private capCombinedExpression(expression: string): string {
    if (expression.trim() === '') {
      return expression;
    }

    return capBooleanExpression({
      expression,
      budget: DEFAULT_BOOLEAN_TERM_BUDGET,
    }).expression;
  }

  // A term's rank is its position in the taxonomy's frequency-ranked list for
  // the function, so a cap keeps the terms the dataset uses most. The class's
  // own label is pinned first: the root's name must never be the term dropped.
  private async getTermRank(
    titleClass: TitleClass,
  ): Promise<(term: string) => number> {
    const key = `${titleClass.functionId}|${titleClass.functionRoot ?? ''}|rank`;
    const cached = this.rankedTermCache.get(key);
    const ranked =
      cached !== undefined && Date.now() - cached.storedAt < CACHE_TTL_MS
        ? cached.value
        : await this.titleTaxonomyRemoteService
            .getRankedKeywords({
              functionId: titleClass.functionId,
              functionRoot: titleClass.functionRoot ?? undefined,
              maxTerms: 12,
            })
            .then((terms) => {
              const map = new Map<string, number>();

              (terms ?? []).forEach((entry, index) => {
                const normalized = this.normalizeTerm(entry.term);

                if (!map.has(normalized)) {
                  map.set(normalized, index);
                }
              });

              this.rankedTermCache.set(key, {
                value: map,
                storedAt: Date.now(),
              });

              return map;
            });

    const rankMap = new Map(ranked);

    rankMap.set(this.normalizeTerm(titleClass.functionId), -1);

    if (titleClass.functionRoot !== null) {
      rankMap.set(this.normalizeTerm(titleClass.functionRoot), -1);
    }

    const rankedEntries = [...rankMap.entries()];

    return (term: string): number => {
      const normalized = this.normalizeTerm(term);
      const exact = rankMap.get(normalized);

      if (exact !== undefined) {
        return exact;
      }

      // "Supply Chain" is ranked by its own words when the taxonomy lists
      // "supply" and "chain" separately, so a curated phrase is not treated as
      // unknown and dropped first
      const tokens = normalized.split(' ').filter((token) => token !== '');
      let best = Number.POSITIVE_INFINITY;

      for (const [rankedTerm, rank] of rankedEntries) {
        const rankedTokens = rankedTerm
          .split(' ')
          .filter((token) => token !== '');

        if (
          rankedTokens.length > 0 &&
          rankedTokens.length <= tokens.length &&
          rankedTokens.every((token) => tokens.includes(token))
        ) {
          best = Math.min(best, rank);
        }
      }

      return best;
    };
  }

  private normalizeTerm(value: string): string {
    return value.replace(/"/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private async fetchRoleQuery(
    titleClass: TitleClass,
    grade: string,
    scope: RoleQueryScope,
  ): Promise<string | null> {
    const response = await this.titleTaxonomyRemoteService.getRoleQuery({
      functionId: titleClass.functionId,
      grade,
      scope,
    });
    return response?.boolean_query?.trim() || null;
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

  // Rung 2a: whole titles from the calibrated lattice for one role. The role is
  // sent as typed because it carries the surface grade term ("vp", "head"):
  // that is what centres the peer window, so "VP Manufacturing" (18y) reaches
  // "head of production" (15y) but a "Head of Manufacturing" (15y) query does
  // not reach "senior director" (20y).
  private async getSimilarTitles(
    role: string,
    titleClass: TitleClass | null,
  ): Promise<string[]> {
    if (titleClass === null) {
      return [];
    }

    const key = [
      titleClass.functionId,
      titleClass.functionRoot ?? '',
      titleClass.grade ?? '',
      role,
      SIMILAR_TITLES_BANDS,
      SIMILAR_TITLES_SCOPE,
    ].join('|');
    const cached = this.similarJobTitlesCache.get(key);

    if (cached !== undefined && Date.now() - cached.storedAt < CACHE_TTL_MS) {
      return cached.value;
    }

    const lattice = await this.titleTaxonomyRemoteService.getSimilarJobTitles({
      title: role,
      functionId: titleClass.functionId,
      grade: titleClass.grade ?? undefined,
      scope: SIMILAR_TITLES_SCOPE,
      bands: SIMILAR_TITLES_BANDS,
      maxTitles: SIMILAR_TITLES_MAX,
    });
    const wholeTitles = (lattice?.titles ?? [])
      .map((title) => title?.trim() ?? '')
      .filter((title) => title !== '');

    if (wholeTitles.length > 0) {
      this.similarJobTitlesCache.set(key, {
        value: wholeTitles,
        storedAt: Date.now(),
      });

      return wholeTitles;
    }

    // Rung 2b: the lattice artifact is missing or the function is not indexed.
    // The OR words are fragments ("plant", "works") rather than titles, so they
    // are a fallback; the lattice answer is retried on the next call because
    // only successful lattice answers are cached.
    this.logger.log(
      `No calibrated titles for "${role}" (${titleClass.functionId}/${titleClass.grade ?? 'unknown'})${lattice?.reason ? `: ${lattice.reason}` : ''}; using the function's OR words`,
    );

    return this.getOrWords(titleClass);
  }

  private async getOrWords(titleClass: TitleClass): Promise<string[]> {
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

  private classKey(titleClass: TitleClass): string {
    return `${titleClass.functionId}|${titleClass.functionRoot ?? ''}|${titleClass.grade ?? ''}`;
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

  // Round-robin over the per-role lists: each list keeps its own order, but no
  // role can push another out of a capped slice
  private interleave(lists: string[][]): string[] {
    const ordered: string[] = [];
    const longest = lists.reduce((max, list) => Math.max(max, list.length), 0);

    for (let index = 0; index < longest; index += 1) {
      for (const list of lists) {
        if (index < list.length) {
          ordered.push(list[index]);
        }
      }
    }

    return ordered;
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

  // Role labels are written back to pair states and the People tab, so they
  // keep their case; only duplicates collapse
  private uniquePreservingCase(values: string[]): string[] {
    const seen = new Set<string>();
    const kept: string[] = [];

    for (const value of values) {
      const trimmed = value.trim().replace(/\s+/g, ' ');
      const key = trimmed.toLowerCase();

      if (trimmed === '' || seen.has(key)) {
        continue;
      }

      seen.add(key);
      kept.push(trimmed);
    }

    return kept;
  }
}
