import { isNonEmptyString } from '@sniptt/guards';

import { toSearchTerms } from 'src/engine/core-modules/title-taxonomy/role-mention-split.util';
import {
  isGoogleTitleClauseUsable,
  toGoogleTitleClause,
} from 'src/engine/core-modules/title-taxonomy/title-boolean.util';
import { type CompanyIdentity } from 'src/engine/core-modules/tool/tools/find-people-by-company-tool/company-identity.util';

// One role family's query cell: the roles it covers, its titles and its
// curated boolean. Everything a source needs to build its own query shape.
export type QueryCell = {
  key: string;
  roles: string[];
  titles: string[];
  titleExpression: string | null;
  // The taxonomy's function and grade, so a source that filters by id
  // (Sales Navigator) can map them instead of guessing from a title string.
  functionRoot?: string;
  grade?: string;
};

const OR_TERMS_MAX = 6;
const BRIGHT_DATA_TITLES_MAX = 6;
// Instant ranks by tokens rather than reading a sentence, so a short query is
// the one it handles well; a long title list dilutes the company match
const INSTANT_TITLES_MAX = 4;

// A plain query is what a person would type, so an abbreviation the taxonomy
// stores ("md", "vp") is spelled out. The boolean query keeps the abbreviation,
// because that is what LinkedIn profiles actually say.
const PLAIN_TITLE_WORDS: Record<string, string> = {
  md: 'managing director',
  ceo: 'chief executive officer',
  cfo: 'chief financial officer',
  coo: 'chief operating officer',
  cto: 'chief technology officer',
  cmo: 'chief marketing officer',
  chro: 'chief human resources officer',
  cpo: 'chief product officer',
  vp: 'vice president',
  svp: 'senior vice president',
  evp: 'executive vice president',
  gm: 'general manager',
};

const plainTitleOf = (titles: string[], roles: string[]): string => {
  const first = toSearchTerms(titles)[0] ?? roles[0] ?? '';
  const spelledOut = PLAIN_TITLE_WORDS[first.trim().toLowerCase()];

  return spelledOut ?? first;
};

const quotedOrGroup = (terms: string[]): string =>
  `(${terms.map((term) => `"${term}"`).join(' OR ')})`;

// A clause that is already one parenthesised group is used as it stands; a
// bare one is wrapped. Wrapping twice produced "(("x"))", which Google reads
// as a nested group and answers worse for.
const wrapClause = (clause: string): string =>
  clause.startsWith('(') && clause.endsWith(')') ? clause : `(${clause})`;

const withLocation = (parts: Array<string | null>, location?: string): string =>
  [...parts, isNonEmptyString(location) ? location.trim() : null]
    .filter((part): part is string => part !== null && part !== '')
    .join(' ');

// The boolean clause a source can send: the curated expression when the
// taxonomy supplied one, otherwise the titles as a quoted OR group. A clause
// Google would drop (too long) falls back to the OR group rather than
// silently searching for the company alone.
export const titleClauseFor = (cell: QueryCell): string | null => {
  if (isNonEmptyString(cell.titleExpression)) {
    const clause = toGoogleTitleClause(cell.titleExpression);

    if (isGoogleTitleClauseUsable(clause)) {
      return clause;
    }
  }

  const titles = toSearchTerms(cell.titles).slice(0, OR_TERMS_MAX);

  return titles.length > 0 ? quotedOrGroup(titles) : null;
};

export type SerpCellQueries = {
  // A string a person would type, with no operators
  plain: string;
  // The same intent restricted to LinkedIn profiles, with the boolean clause
  boolean: string;
};

// Every family gets both shapes. The plain query is the broad net (news,
// leadership pages, directories); the boolean one is the precise net. Sending
// only one of them was the old behaviour and it lost whichever half the other
// shape would have caught.
export const buildSerpCellQueries = ({
  identity,
  cell,
  location,
}: {
  identity: CompanyIdentity;
  cell: QueryCell;
  location?: string;
}): SerpCellQueries => {
  const company = identity.canonicalName;
  const primaryTitle = plainTitleOf(cell.titles, cell.roles);
  const clause = titleClauseFor(cell);

  return {
    plain: withLocation([company, primaryTitle], location),
    boolean:
      clause === null
        ? withLocation(['site:linkedin.com/in', `"${company}"`], location)
        : withLocation(
            ['site:linkedin.com/in', `"${company}"`, wrapClause(clause)],
            location,
          ),
  };
};

export type BrightDataCellQueries = {
  // The structured planner's natural-language prompt: the boolean goes beside
  // it as a code-owned filter, so the sentence only has to carry company,
  // place and (optionally) titles
  ludicrous: string;
  // The instant search's prompt: token-ranked, so it stays short
  instant: string;
};

export const buildBrightDataCellQueries = ({
  identity,
  cell,
  location,
}: {
  identity: CompanyIdentity;
  cell: QueryCell;
  location?: string;
}): BrightDataCellQueries => {
  const company = identity.canonicalName;
  const titles = toSearchTerms(cell.titles).slice(0, BRIGHT_DATA_TITLES_MAX);
  const instantTitles = titles.slice(0, INSTANT_TITLES_MAX);

  return {
    // Curated taxonomy boolean owns the title filter; keep the sentence to
    // company and place so the planner does not re-list title words
    ludicrous: isNonEmptyString(cell.titleExpression)
      ? withLocation([`people at ${company}`], location)
      : withLocation([`${titles.join(', ')} of ${company}`], location),
    instant: withLocation(
      [
        instantTitles.length > 0
          ? `${instantTitles.join(' ')} at ${company}`
          : `people at ${company}`,
      ],
      undefined,
    ),
  };
};

export type HarvestCellParameters = Record<string, string | string[]>;

// Harvest lead-search parameters, in Harvest's own names. The caller passes
// this through buildHarvestSearchQuery, which drops anything Harvest does not
// document for a lead search, so a mistake here fails loudly instead of
// returning zero rows.
export const buildHarvestCellParameters = ({
  identity,
  cell,
  location,
  geoIds = [],
  companyLinkedinUrl,
  industryIds = [],
  functionIds = [],
  seniorityLevelIds = [],
}: {
  identity: CompanyIdentity;
  cell: QueryCell;
  location?: string;
  geoIds?: string[];
  companyLinkedinUrl?: string;
  industryIds?: string[];
  functionIds?: string[];
  seniorityLevelIds?: string[];
}): HarvestCellParameters => {
  const expression = isNonEmptyString(cell.titleExpression)
    ? cell.titleExpression.trim()
    : null;
  // The identity already carries the LinkedIn company when the index knew it,
  // so a caller that resolved the company does not have to pass it twice
  const companyUrl = isNonEmptyString(companyLinkedinUrl)
    ? companyLinkedinUrl.trim()
    : identity.linkedinUrl?.trim();
  const parameters: HarvestCellParameters = {};

  if (isNonEmptyString(companyUrl)) {
    parameters.currentCompanies = companyUrl;
  }

  if (expression !== null) {
    // A factored boolean (AND / NOT / nesting) only the `search` field
    // understands; a flat OR list is what `currentJobTitles` filters exactly
    if (/\b(AND|NOT)\b|[()]/.test(expression)) {
      parameters.search = expression;
    } else {
      parameters.currentJobTitles = expression
        .replace(/^\((.*)\)$/s, '$1')
        .split(/\s+OR\s+/i)
        .map((term) => term.trim().replace(/^"|"$/g, ''))
        .filter(isNonEmptyString);
    }
  } else if (cell.titles.length > 0) {
    parameters.currentJobTitles = cell.titles.slice(0, OR_TERMS_MAX);
  }

  // geoIds overrides the location string on Harvest's side. Preferring it keeps
  // a compound name like "Mumbai, Maharashtra, India" from being read as three
  // locations, where the country would widen the search to all of India.
  if (geoIds.length > 0) {
    parameters.geoIds = geoIds;
  } else if (isNonEmptyString(location)) {
    parameters.locations = location.trim();
  }

  if (industryIds.length > 0) {
    parameters.industryIds = industryIds;
  }

  if (functionIds.length > 0) {
    parameters.functionIds = functionIds;
  }

  if (seniorityLevelIds.length > 0) {
    parameters.seniorityLevelIds = seniorityLevelIds;
  }

  // The company is the anchor: without its URL Harvest has no company filter
  // at all, and a title-only search would page through LinkedIn at our cost
  if (!isNonEmptyString(companyUrl)) {
    delete parameters.currentCompanies;
  }

  return parameters;
};

export const harvestParametersHaveCompany = (
  parameters: HarvestCellParameters,
): boolean => isNonEmptyString(parameters.currentCompanies);

export const identityIndustryNames = (identity: CompanyIdentity): string[] =>
  isNonEmptyString(identity.industry) ? [identity.industry.trim()] : [];

// Place name to ISO 3166-1 alpha-2. The company index stores a country name
// and Bright Data filters on the code, so one of them has to be translated.
const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  india: 'IN',
  'united arab emirates': 'AE',
  uae: 'AE',
  dubai: 'AE',
  'united states': 'US',
  'united states of america': 'US',
  usa: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
  singapore: 'SG',
  australia: 'AU',
  canada: 'CA',
  germany: 'DE',
  france: 'FR',
  netherlands: 'NL',
  brazil: 'BR',
  indonesia: 'ID',
  vietnam: 'VN',
  philippines: 'PH',
  malaysia: 'MY',
};

export const countryCodeFor = (place?: string): string | undefined => {
  if (!isNonEmptyString(place)) {
    return undefined;
  }

  const trimmed = place.trim();
  const lowered = trimmed.toLowerCase();

  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }

  const exact = COUNTRY_CODE_BY_NAME[lowered];

  if (exact !== undefined) {
    return exact;
  }

  const named = Object.entries(COUNTRY_CODE_BY_NAME).find(([name]) =>
    new RegExp(`(^|[^a-z])${name}($|[^a-z])`).test(lowered),
  );

  return named?.[1];
};

export const identityCountryCodes = (
  identity: CompanyIdentity,
  location?: string,
): string[] => {
  const code = countryCodeFor(identity.country) ?? countryCodeFor(location);

  return code === undefined ? [] : [code];
};
