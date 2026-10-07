import { BRIGHT_DATA_LINKEDIN_INDUSTRIES_HINT } from 'src/engine/core-modules/bright-data/ludicrous/constants/bright-data-ludicrous-field-registry.const';
import { type BrightDataLudicrousShardFilter } from 'src/engine/core-modules/bright-data/ludicrous/schemas/bright-data-ludicrous-plan-llm.schema';
import {
  type BrightDataLudicrousEntity,
  type BrightDataLudicrousQuery,
} from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';
import {
  compileBooleanTitleString,
  compileTitleGroups,
  ludicrousAnd,
  ludicrousEquals,
  ludicrousIn,
  ludicrousOr,
  ludicrousRange,
  ludicrousText,
  stripBooleanSyntax,
  validateAndNormalizeLudicrousQuery,
} from 'src/engine/core-modules/bright-data/ludicrous/utils/bright-data-ludicrous-query.util';

const clean = (values: string[] | undefined): string[] =>
  (values ?? [])
    .map((value) => stripBooleanSyntax(value))
    .filter((value) => value.length > 0);

const TAXONOMY_BY_LOWERCASE = new Map(
  BRIGHT_DATA_LINKEDIN_INDUSTRIES_HINT.map((name) => [
    name.toLowerCase(),
    name,
  ]),
);

// `industry` only matches LinkedIn's own industry names. A made-up one such as
// "Fintech" matches nothing, so unknown phrases become specialty keywords.
export const splitIndustriesByTaxonomy = (
  phrases: string[],
): { industries: string[]; keywords: string[] } => {
  const industries: string[] = [];
  const keywords: string[] = [];

  for (const phrase of phrases) {
    const known = TAXONOMY_BY_LOWERCASE.get(phrase.toLowerCase());

    if (known !== undefined) {
      industries.push(known);
    } else {
      keywords.push(phrase);
    }
  }

  return { industries, keywords };
};

const anyOfPhrases = (
  field: string,
  phrases: string[],
): BrightDataLudicrousQuery | null =>
  phrases.length === 0
    ? null
    : ludicrousOr(
        ...phrases.map((phrase) => ludicrousText(field, phrase, 'all')),
      );

const compilePeople = (
  filter: Partial<BrightDataLudicrousShardFilter>,
): Array<BrightDataLudicrousQuery | null> => {
  const titles = clean(filter.titles);
  const titleClause = filter.booleanTitleExpression?.trim()
    ? compileBooleanTitleString({
        field: 'current_title',
        expression: filter.booleanTitleExpression,
      })
    : titles.length > 0
      ? compileTitleGroups({
          field: 'current_title',
          titles,
          excludeWords: clean(filter.excludeTitleWords),
        })
      : null;

  return [
    titleClause,
    filter.countryCodes?.length
      ? ludicrousIn('country_code', filter.countryCodes)
      : null,
    filter.cities?.length ? ludicrousIn('city', filter.cities) : null,
    anyOfPhrases('current_company_name', clean(filter.companyNames)),
    anyOfPhrases('current_company_industry', clean(filter.industries)),
    anyOfPhrases('skill', clean(filter.skills)),
  ];
};

const compileCompany = (
  filter: Partial<BrightDataLudicrousShardFilter>,
): Array<BrightDataLudicrousQuery | null> => {
  const { industries, keywords } = splitIndustriesByTaxonomy(
    clean(filter.industries),
  );
  const specialties = [...clean(filter.specialtiesAny), ...keywords];
  const yearBounds = {
    ...(typeof filter.foundedFrom === 'number'
      ? { '>=': filter.foundedFrom }
      : {}),
    ...(typeof filter.foundedTo === 'number' ? { '<=': filter.foundedTo } : {}),
  };

  return [
    anyOfPhrases('industry', industries),
    filter.countryCodes?.length
      ? ludicrousIn('headquarters_country_code', filter.countryCodes)
      : null,
    filter.cities?.length
      ? ludicrousIn('headquarters_city', filter.cities)
      : null,
    filter.organizationTypes?.length
      ? ludicrousIn('organization_type', [...filter.organizationTypes])
      : null,
    filter.fundingStages?.length
      ? ludicrousIn('funding_stage', [...filter.fundingStages])
      : null,
    filter.sizeBuckets?.length
      ? ludicrousOr(
          ...filter.sizeBuckets.map((bucket) =>
            ludicrousEquals('company_size_from', Number(bucket)),
          ),
        )
      : null,
    Object.keys(yearBounds).length > 0
      ? ludicrousRange('founded_year', yearBounds)
      : null,
    // One all-words clause per phrase: a single any-bag lets generic words
    // such as "software" match nearly every company
    anyOfPhrases('specialties', specialties),
    anyOfPhrases('name', clean(filter.companyNames)),
  ];
};

// Compiles one flat shard filter into a validated ludicrous query. Throws with
// the validator's message if the result is not something the API will honour.
export const compileShardFilter = ({
  entity,
  filter,
}: {
  entity: BrightDataLudicrousEntity;
  filter: Partial<BrightDataLudicrousShardFilter>;
}): { query: BrightDataLudicrousQuery; normalizations: string[] } => {
  const conditions =
    entity === 'people' ? compilePeople(filter) : compileCompany(filter);
  const present = conditions.filter(
    (condition): condition is BrightDataLudicrousQuery => condition !== null,
  );

  if (present.length === 0) {
    throw new Error('Shard filter has no usable conditions');
  }

  const result = validateAndNormalizeLudicrousQuery({
    entity,
    query: ludicrousAnd(...present),
  });

  if (result.issues.length > 0) {
    throw new Error(
      result.issues.map((issue) => `${issue.path} ${issue.message}`).join('; '),
    );
  }

  return { query: result.query, normalizations: result.normalizations };
};
