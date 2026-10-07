import {
  type BrightDataLudicrousEntity,
  type BrightDataLudicrousRubric,
} from 'src/engine/core-modules/bright-data/ludicrous/types/bright-data-ludicrous.types';

const compilePatterns = (patterns: string[]): RegExp[] =>
  patterns
    .map((pattern) => {
      try {
        return new RegExp(pattern, 'i');
      } catch {
        return null;
      }
    })
    .filter((pattern): pattern is RegExp => pattern !== null);

const readString = (data: Record<string, unknown>, key: string): string => {
  const value = data[key];

  return typeof value === 'string' ? value : '';
};

const readNumber = (
  data: Record<string, unknown>,
  key: string,
): number | null => {
  const value = data[key];

  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

// Structured constraints the API itself returns exactly (country, size bucket).
// These are safe to reject on without a model: a wrong value is a wrong record.
export const passesRubricHardConstraints = ({
  entity,
  data,
  rubric,
}: {
  entity: BrightDataLudicrousEntity;
  data: Record<string, unknown>;
  rubric: BrightDataLudicrousRubric;
}): boolean => {
  const country = readString(
    data,
    entity === 'people' ? 'country_code' : 'headquarters_country_code',
  ).toUpperCase();
  const sizeFrom = readNumber(data, 'company_size_from');

  if (
    rubric.countryCodes.length > 0 &&
    country !== '' &&
    !rubric.countryCodes.includes(country)
  ) {
    return false;
  }

  return !(
    entity === 'company' &&
    rubric.companySizeFromBuckets.length > 0 &&
    sizeFrom !== null &&
    !rubric.companySizeFromBuckets.includes(sizeFrom)
  );
};

// The rubric is written once by the LLM at plan time. Scoring each fetched page
// against it is plain code, so the decay loop adds no model calls and no cost.
export const scoreRecordAgainstRubric = ({
  entity,
  data,
  rubric,
}: {
  entity: BrightDataLudicrousEntity;
  data: Record<string, unknown>;
  rubric: BrightDataLudicrousRubric;
}): boolean => {
  if (entity === 'people') {
    const title = readString(data, 'current_title');
    const country = readString(data, 'country_code').toUpperCase();
    const includes = compilePatterns(rubric.titleIncludePatterns);
    const excludes = compilePatterns(rubric.titleExcludePatterns);

    if (
      rubric.countryCodes.length > 0 &&
      country !== '' &&
      !rubric.countryCodes.includes(country)
    ) {
      return false;
    }

    if (excludes.some((pattern) => pattern.test(title))) {
      return false;
    }

    return (
      includes.length === 0 || includes.some((pattern) => pattern.test(title))
    );
  }

  const industry = readString(data, 'industry');
  const country = readString(data, 'headquarters_country_code').toUpperCase();
  const sizeFrom = readNumber(data, 'company_size_from');
  const industryPatterns = compilePatterns(rubric.industryIncludePatterns);

  if (
    rubric.countryCodes.length > 0 &&
    country !== '' &&
    !rubric.countryCodes.includes(country)
  ) {
    return false;
  }

  if (
    rubric.companySizeFromBuckets.length > 0 &&
    sizeFrom !== null &&
    !rubric.companySizeFromBuckets.includes(sizeFrom)
  ) {
    return false;
  }

  return (
    industryPatterns.length === 0 ||
    industryPatterns.some((pattern) => pattern.test(industry))
  );
};

export const computeRubricPrecision = ({
  entity,
  records,
  rubric,
}: {
  entity: BrightDataLudicrousEntity;
  records: Array<Record<string, unknown>>;
  rubric: BrightDataLudicrousRubric;
}): number | null => {
  if (records.length === 0) {
    return null;
  }

  const accurate = records.filter((data) =>
    scoreRecordAgainstRubric({ entity, data, rubric }),
  ).length;

  return accurate / records.length;
};
