import { msg } from '@lingui/core/macro';
import { type RawJsonFilter } from 'twenty-shared/types';
import { isAllowedRawJsonPathKey, isDefined } from 'twenty-shared/utils';

import {
  CommonQueryRunnerException,
  CommonQueryRunnerExceptionCode,
} from 'src/engine/api/common/common-query-runners/errors/common-query-runner.exception';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';

const RAW_JSON_PATH_NUMERIC_OPERATORS = new Set(['gt', 'gte', 'lt', 'lte']);

export const validateAndTransformRawJsonPathFilterOrThrow = (
  fieldName: string,
  filterValue: Record<string, unknown>,
  _fieldMetadata: FlatFieldMetadata,
): RawJsonFilter => {
  const path = filterValue.path;

  if (typeof path !== 'string' || !isAllowedRawJsonPathKey(path)) {
    throw new CommonQueryRunnerException(
      `Filter for field "${fieldName}" has an invalid RAW_JSON path`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_FILTER,
      {
        userFriendlyMessage: msg`Invalid RAW_JSON path filter`,
      },
    );
  }

  if (filterValue.isEmpty === true) {
    return { path, isEmpty: true };
  }

  if (filterValue.isEmpty === false) {
    return { path, isEmpty: false };
  }

  const operatorEntries = Object.entries(filterValue).filter(
    ([operator]) => operator !== 'path',
  );

  if (operatorEntries.length !== 1) {
    throw new CommonQueryRunnerException(
      `Filter for field "${fieldName}" must have exactly one operator`,
      CommonQueryRunnerExceptionCode.INVALID_ARGS_FILTER,
      {
        userFriendlyMessage: msg`Invalid filter: exactly one operator per field is required`,
      },
    );
  }

  const [[operator, value]] = operatorEntries;

  if (operator === 'eq' || operator === 'neq') {
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      throw new CommonQueryRunnerException(
        `Invalid value for RAW_JSON path filter on "${fieldName}.${path}"`,
        CommonQueryRunnerExceptionCode.INVALID_ARGS_FILTER,
      );
    }

    return { path, [operator]: value } as RawJsonFilter;
  }

  if (operator === 'in') {
    if (!Array.isArray(value) || value.length === 0) {
      throw new CommonQueryRunnerException(
        `Invalid value for RAW_JSON path filter on "${fieldName}.${path}"`,
        CommonQueryRunnerExceptionCode.INVALID_ARGS_FILTER,
      );
    }

    return { path, in: value as (string | number)[] };
  }

  if (RAW_JSON_PATH_NUMERIC_OPERATORS.has(operator)) {
    if (typeof value !== 'number') {
      throw new CommonQueryRunnerException(
        `Invalid value for RAW_JSON path filter on "${fieldName}.${path}"`,
        CommonQueryRunnerExceptionCode.INVALID_ARGS_FILTER,
      );
    }

    return { path, [operator]: value } as RawJsonFilter;
  }

  throw new CommonQueryRunnerException(
    `Operator "${operator}" is not valid for RAW_JSON path filter on "${fieldName}"`,
    CommonQueryRunnerExceptionCode.INVALID_ARGS_FILTER,
  );
};

export const isRawJsonPathFilter = (
  filterValue: Record<string, unknown>,
): filterValue is RawJsonFilter & { path: string } =>
  isDefined(filterValue.path) && typeof filterValue.path === 'string';
