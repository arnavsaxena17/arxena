import { type RawJsonFilter } from '@/types';
import { isDefined } from '@/utils/validation/isDefined';

const readJsonPathValue = (
  value: unknown,
  path: string,
): string | number | boolean | null | undefined => {
  if (!isDefined(value) || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const fieldValue = record[path];

  if (
    fieldValue === null ||
    typeof fieldValue === 'string' ||
    typeof fieldValue === 'number' ||
    typeof fieldValue === 'boolean'
  ) {
    return fieldValue;
  }

  return undefined;
};

export const isMatchingRawJsonFilter = ({
  rawJsonFilter,
  value,
}: {
  rawJsonFilter: RawJsonFilter;
  value: unknown;
}) => {
  if (isDefined(rawJsonFilter.path)) {
    const pathValue = readJsonPathValue(value, rawJsonFilter.path);

    if (rawJsonFilter.isEmpty === true) {
      return (
        pathValue === null ||
        pathValue === undefined ||
        pathValue === '' ||
        (typeof pathValue === 'number' && Number.isNaN(pathValue))
      );
    }

    if (rawJsonFilter.isEmpty === false) {
      return (
        pathValue !== null &&
        pathValue !== undefined &&
        pathValue !== '' &&
        !(typeof pathValue === 'number' && Number.isNaN(pathValue))
      );
    }

    if (rawJsonFilter.eq !== undefined) {
      return pathValue === rawJsonFilter.eq;
    }

    if (rawJsonFilter.neq !== undefined) {
      return pathValue !== rawJsonFilter.neq;
    }

    if (rawJsonFilter.in !== undefined) {
      return rawJsonFilter.in.some((item) => item === pathValue);
    }

    if (rawJsonFilter.gt !== undefined) {
      return (
        typeof pathValue === 'number' && pathValue > rawJsonFilter.gt
      );
    }

    if (rawJsonFilter.gte !== undefined) {
      return (
        typeof pathValue === 'number' && pathValue >= rawJsonFilter.gte
      );
    }

    if (rawJsonFilter.lt !== undefined) {
      return (
        typeof pathValue === 'number' && pathValue < rawJsonFilter.lt
      );
    }

    if (rawJsonFilter.lte !== undefined) {
      return (
        typeof pathValue === 'number' && pathValue <= rawJsonFilter.lte
      );
    }

    throw new Error(
      `Unexpected path filter for RAW_JSON: ${JSON.stringify(rawJsonFilter)}`,
    );
  }

  switch (true) {
    case rawJsonFilter.like !== undefined: {
      const regexPattern = rawJsonFilter.like.replace(/%/g, '.*');
      const regexCaseInsensitive = new RegExp(`^${regexPattern}$`, 'is');

      const stringValue = JSON.stringify(value, null, 1);

      return regexCaseInsensitive.test(stringValue);
    }
    case rawJsonFilter.is !== undefined: {
      if (rawJsonFilter.is === 'NULL') {
        return value === null || value === undefined;
      }

      return value !== null && value !== undefined;
    }
    default: {
      throw new Error(
        `Unexpected value for RAW_JSON filter : ${JSON.stringify(rawJsonFilter)}`,
      );
    }
  }
};
