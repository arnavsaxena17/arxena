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
// A multi-word phrase is kept as an industry: the full LinkedIn taxonomy is
// larger than the prompt hint, and treating "Glass, Ceramics and Concrete
// Manufacturing" as a specialty would search the about text instead of the
// company's own industry label.
// The full LinkedIn taxonomy is larger than the prompt hint, so a label that
// reads like one ("Glass, Ceramics and Concrete Manufacturing") is kept as an
// industry. A business-model phrase ("quick service restaurant") is not: it
// belongs in the about/specialties text.
const INDUSTRY_SUFFIX =
  /\b(manufacturing|services|retail|wholesale|industry|industries|technology|technologies|education|construction|utilities|mining|agriculture|farming|forestry|transportation|storage|logistics|hospitality)\b/i;

const looksLikeIndustryLabel = (phrase: string): boolean =>
  INDUSTRY_SUFFIX.test(phrase);

export const splitIndustriesByTaxonomy = (
  phrases: string[],
): { industries: string[]; keywords: string[] } => {
  const industries: string[] = [];
  const keywords: string[] = [];

  for (const phrase of phrases) {
    const known = TAXONOMY_BY_LOWERCASE.get(phrase.toLowerCase());

    if (known !== undefined) {
      industries.push(known);
    } else if (looksLikeIndustryLabel(phrase)) {
      industries.push(phrase);
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

// Topic phrases match in the about text or the specialties list, every word
// of the phrase required (mode all). Matches the shape that works live:
// or(text(about, phrase, all), text(specialties, phrase, all)) per phrase.
const anyOfPhrasesInFields = (
  fields: string[],
  phrases: string[],
): BrightDataLudicrousQuery | null =>
  phrases.length === 0
    ? null
    : ludicrousOr(
        ...phrases.flatMap((phrase) =>
          fields.map((field) => ludicrousText(field, phrase, 'all')),
        ),
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
    // offices, not HQ: a brand run from abroad with Indian outlets still counts
    filter.countryCodes?.length
      ? // array field: always `in`, even for one code (equals is rejected)
        { in: { offices_country_codes: filter.countryCodes } }
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
    anyOfPhrasesInFields(['about', 'specialties'], specialties),
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
