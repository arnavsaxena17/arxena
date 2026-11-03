import { type LinkedInSeniorityType } from 'src/engine/core-modules/linkedin-search/types/linkedin-search-parameter.type';
import { type LinkedInCompanyTypeValue } from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';
import type {
  ParsedRequirement,
  SearchQuery,
  SearchQuerySet,
} from 'src/engine/core-modules/linkedin-query-generation/types/linkedin-query-generation.types';

// Agent 3 is told `keywords` is at most 6 terms; the same budget is used here so
// folding the requirement in cannot push a query past what the validator allows
const MAX_KEYWORDS_TERMS = 6;

const COMPANY_TYPE_BY_PHRASE: Array<{
  pattern: RegExp;
  value: LinkedInCompanyTypeValue;
}> = [
  { pattern: /\b(public|listed|stock exchange)\b/i, value: 'public_company' },
  { pattern: /\b(private|privately)\b/i, value: 'privately_held' },
  { pattern: /\b(non[- ]?profit|ngo|charity)\b/i, value: 'non_profit' },
  { pattern: /\b(government|public sector)\b/i, value: 'government_agency' },
  { pattern: /\b(educational|university|college|school)\b/i, value: 'educational_institution' },
  { pattern: /\bpartnership\b/i, value: 'partnership' },
  { pattern: /\bself[- ]?(employed|owned)\b/i, value: 'self_employed' },
];

// The parse returns a free phrase ("senior", "CXO", "reporting to"), and the
// facets take the seat's own enum, so the common words map explicitly and
// anything unrecognised stays unsent rather than becoming a wrong level
const SENIORITY_BY_PHRASE: Array<{
  pattern: RegExp;
  value: LinkedInSeniorityType;
}> = [
  { pattern: /\b(owner|partner|founder|proprietor)\b/i, value: 'owner/partner' },
  { pattern: /\b(cxo|chief|ceo|cfo|coo|cto|cmo)\b/i, value: 'cxo' },
  { pattern: /\b(vp|vice president|svp|avp)\b/i, value: 'vice_president' },
  { pattern: /\b(director|head of function)\b/i, value: 'director' },
  { pattern: /\b(senior manager|manager)\b/i, value: 'experienced_manager' },
  { pattern: /\b(entry level manager|team lead|lead)\b/i, value: 'entry_level_manager' },
  { pattern: /\b(senior|sr\.?)\b/i, value: 'senior' },
  { pattern: /\b(entry level|junior|associate|graduate)\b/i, value: 'entry_level' },
  { pattern: /\b(intern|trainee|in training)\b/i, value: 'in_training' },
];

export const toLinkedInSeniority = (
  raw: string | null | undefined,
): LinkedInSeniorityType | undefined => {
  const text = raw?.trim();

  if (!text) {
    return undefined;
  }

  return SENIORITY_BY_PHRASE.find(({ pattern }) => pattern.test(text))?.value;
};

/** "listed" / "public company" / "private" → the facet enum, or undefined */
export const toLinkedInCompanyType = (
  raw: string | null | undefined,
): LinkedInCompanyTypeValue | undefined => {
  const text = raw?.trim();

  if (!text) {
    return undefined;
  }

  return COMPANY_TYPE_BY_PHRASE.find(({ pattern }) => pattern.test(text))?.value;
};

const splitTerms = (value: string | null | undefined): string[] =>
  (value ?? '').split(/[\s,]+/).map((term) => term.trim()).filter(Boolean);

// `keywords` is a LinkedIn boolean expression, not a word list, so the budget is
// counted the way the validator counts it: words, minus the operators
const countExpressionTerms = (expression: string | null | undefined): number =>
  splitTerms(expression).filter(
    (token) => !/^(AND|OR|NOT|\(|\))$/i.test(token) && !/^[()]+$/.test(token),
  ).length;

// A multi-word term has to be quoted or LinkedIn reads it as two words
const asBooleanTerm = (term: string): string =>
  /\s/.test(term) ? `"${term.replace(/"/g, '')}"` : term;

const uniqueLower = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const value of values) {
    const term = value?.trim();

    if (!term) {
      continue;
    }

    const key = term.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    kept.push(term);
  }

  return kept;
};

/**
 * Fold the parsed requirement into one query, within the term budget.
 *
 * The request's own words win: a term already in `keywords` is not added again,
 * and a query that already has a full budget keeps it. Anything that does not
 * fit is reported back so the caller can see what was dropped instead of the
 * requirement silently disappearing.
 */
export const applyRequirementToQuery = (
  query: SearchQuery,
  requirement: ParsedRequirement,
): { query: SearchQuery; dropped: string[] } => {
  const industryTerms = uniqueLower(requirement.industry_terms ?? []);
  const certifications = uniqueLower(requirement.certifications ?? []);

  const companyTypeRaw = requirement.company_type?.trim() || null;
  const companyType = toLinkedInCompanyType(companyTypeRaw);

  // Industry and certifications are the constraints a LinkedIn people search can
  // only express as keywords; company type has its own facet where a seat has one
  const wanted = uniqueLower([...industryTerms, ...certifications]);
  const existing = query.keywords?.trim() || null;
  const alreadyThere = (term: string): boolean =>
    (existing ?? '').toLowerCase().includes(term.toLowerCase().replace(/\s+/g, ' '));

  const missing = wanted.filter((term) => !alreadyThere(term));
  const budget = Math.max(
    0,
    MAX_KEYWORDS_TERMS - countExpressionTerms(existing),
  );
  const addable = missing.slice(0, budget);
  const dropped = missing.slice(addable.length);

  // Append as one OR-group rather than bare words, so the result is a valid
  // boolean whatever the existing expression looks like
  const group =
    addable.length > 0
      ? `(${addable.map(asBooleanTerm).join(' OR ')})`
      : null;
  const keywords = [existing, group].filter(Boolean).join(' AND ') || null;

  const yearsMin = query.years_min ?? requirement.years_min ?? null;
  const yearsMax = query.years_max ?? requirement.years_max ?? null;

  const years =
    query.years_of_experience ??
    (yearsMin === null && yearsMax === null
      ? null
      : `${yearsMin ?? ''}-${yearsMax ?? ''}`);

  return {
    query: {
      ...query,
      keywords,
      industry_terms:
        query.industry_terms && query.industry_terms.length > 0
          ? query.industry_terms
          : industryTerms,
      certifications:
        query.certifications && query.certifications.length > 0
          ? query.certifications
          : certifications,
      seniority:
        query.seniority ?? toLinkedInSeniority(requirement.seniority_level) ?? null,
      function:
        query.function ??
        (requirement.domain_expertise?.[0]?.trim() || null),
      company_type: query.company_type ?? companyType ?? null,
      company_type_raw: query.company_type_raw ?? companyTypeRaw,
      years_min: yearsMin,
      years_max: yearsMax,
      years_of_experience: years,
    },
    dropped,
  };
};

/**
 * Apply the requirement to every query in the set.
 *
 * Lives on the server side of the pipeline on purpose: Agent 3 and Agent 4 are
 * free to ignore the requirement, and before this the discarded fields never
 * reached the search parameters at all.
 */
export const applyParsedRequirementToQuerySet = (
  querySet: SearchQuerySet,
  requirement: ParsedRequirement,
): { querySet: SearchQuerySet; dropped: string[] } => {
  const dropped = new Set<string>();

  const search_query_set = querySet.search_query_set.map((query) => {
    const applied = applyRequirementToQuery(query, requirement);

    applied.dropped.forEach((term) => dropped.add(term));

    return applied.query;
  });

  return { querySet: { ...querySet, search_query_set }, dropped: [...dropped] };
};
